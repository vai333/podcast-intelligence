// Nightly discovery for one show (spec 6.3).
//  - only episodes published after max(last_seen_published_at, active_from) are ever ingested
//  - YouTube uploads playlist + videos.list; Spotify episodes when Spotify is configured
//  - a YouTube video and a Spotify episode of the same show are merged into one row
//  - Shorts/clips and over-long episodes are stored as 'skipped' (and logged), not analysed
import { and, between, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { episodes, shows, viewSnapshots } from "@/lib/db/schema";
import { spotifyEnabled } from "@/lib/env";
import { canonicalKey, isSameEpisode } from "@/lib/sources/match";
import * as sp from "@/lib/sources/spotify";
import * as yt from "@/lib/sources/youtube";
import { errMsg, logEvent } from "./log";
import { enqueue } from "./queue";
import { getSettings } from "./settings";

export interface DiscoverResult {
  found: number;
  inserted: number;
  skipped: number;
  merged: number;
  /** Shorts and clips under the minimum length: ignored, not stored. */
  ignored: number;
}

const H72 = 72 * 3_600_000;

type NewEpisode = typeof episodes.$inferInsert;

export async function discoverShow(showId: string): Promise<DiscoverResult> {
  const result: DiscoverResult = { found: 0, inserted: 0, skipped: 0, merged: 0, ignored: 0 };
  const [show] = await db().select().from(shows).where(eq(shows.id, showId));
  if (!show || show.activeTo) return result; // removed since the job was queued

  const hasYoutube = !!show.youtubeUploadsPlaylistId;
  const hasSpotify = !!show.spotifyShowId && spotifyEnabled();
  if (!hasYoutube && !hasSpotify) {
    const why = show.spotifyShowId ? "Spotify is not configured" : "no YouTube channel or Spotify show is linked";
    await db().update(shows).set({ lastError: `Nothing to check: ${why}.`, lastDiscoveredAt: new Date() }).where(eq(shows.id, show.id));
    await logEvent("warn", "show", `Nothing to check: ${why}.`, { id: show.id, label: show.name });
    return result;
  }

  const settings = await getSettings();
  const since = Math.max(show.lastSeenPublishedAt?.getTime() ?? 0, show.activeFrom.getTime());
  const minSec = settings.minEpisodeMinutes * 60;
  const maxSec = settings.maxEpisodeMinutes * 60;
  let newest = show.lastSeenPublishedAt?.getTime() ?? 0;
  const errors: string[] = [];

  /** Shorts and clips (under the minimum) are not episodes at all: they are ignored and never stored. */
  const isClip = (durationSeconds: number | null) => durationSeconds !== null && durationSeconds < minSec;

  const classify = (durationSeconds: number | null): { status: "discovered" | "skipped"; note: string | null } => {
    if (durationSeconds !== null && durationSeconds > maxSec) return { status: "skipped", note: `Longer than ${settings.maxEpisodeMinutes} min (limit from Settings).` };
    return { status: "discovered", note: null };
  };

  /** Insert one episode; returns its id if it was new. */
  async function insertEpisode(v: NewEpisode, views: { views: number | null; likes: number | null; comments: number | null } | null) {
    const [row] = await db().insert(episodes).values(v).onConflictDoNothing().returning({ id: episodes.id });
    if (!row) return null;
    if (views?.views !== null && views?.views !== undefined) {
      await db().insert(viewSnapshots).values({ episodeId: row.id, views: views.views, likes: views.likes, comments: views.comments });
    }
    result.inserted++;
    if (v.status === "skipped") {
      result.skipped++;
      await logEvent("warn", "episode", v.statusNote ?? "Skipped", { id: row.id, label: v.title });
    } else {
      await enqueue("extract_episode", { episodeId: row.id });
    }
    return row.id;
  }

  /* ------------------------------ YouTube ------------------------------ */
  if (hasYoutube) {
    try {
      const uploads = await yt.listUploadsSince(show.youtubeUploadsPlaylistId!, since);
      const videos = uploads.length ? await yt.getVideos(uploads.map((u) => u.videoId)) : [];
      for (const v of videos.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())) {
        const at = v.publishedAt.getTime();
        if (at <= since) continue;
        newest = Math.max(newest, at);
        if (isClip(v.durationSeconds)) {
          result.ignored++;
          continue;
        }
        result.found++;
        const [exists] = await db().select({ id: episodes.id }).from(episodes).where(eq(episodes.youtubeVideoId, v.id));
        if (exists) continue;

        const c = classify(v.durationSeconds);
        // A Spotify-only row for the same episode may already exist (Spotify published first): merge into it.
        const twin = await findTwin(show.id, show.name, { title: v.title, publishedAt: at, durationSeconds: v.durationSeconds }, "spotify-only");
        if (twin) {
          await db()
            .update(episodes)
            .set({
              youtubeVideoId: v.id,
              youtubeUrl: yt.youtubeWatchUrl(v.id),
              analysisDepth: "video",
              durationSeconds: twin.durationSeconds ?? v.durationSeconds,
              // If it was already analysed from metadata only, analyse again now that video exists.
              ...(twin.status === "extracted" ? { status: "discovered" as const } : {}),
            })
            .where(eq(episodes.id, twin.id));
          if (v.views !== null) await db().insert(viewSnapshots).values({ episodeId: twin.id, views: v.views, likes: v.likes, comments: v.comments });
          if (twin.status === "extracted") await enqueue("extract_episode", { episodeId: twin.id });
          result.merged++;
          continue;
        }
        await insertEpisode(
          {
            showId: show.id,
            youtubeVideoId: v.id,
            title: v.title,
            description: v.description,
            publishedAt: v.publishedAt,
            durationSeconds: v.durationSeconds,
            youtubeUrl: yt.youtubeWatchUrl(v.id),
            canonicalKey: canonicalKey(v.title, at, show.name),
            analysisDepth: "video",
            status: c.status,
            statusNote: c.note,
          },
          { views: v.views, likes: v.likes, comments: v.comments },
        );
      }
    } catch (e) {
      if (e instanceof yt.QuotaError) throw e;
      errors.push(`YouTube: ${errMsg(e)}`);
      await logEvent("error", "show", `YouTube check failed: ${errMsg(e)}`, { id: show.id, label: show.name });
    }
  }

  /* ------------------------------ Spotify ------------------------------ */
  if (hasSpotify) {
    try {
      const sinceDay = new Date(since).toISOString().slice(0, 10);
      const eps = await sp.getEpisodes(show.spotifyShowId!);
      for (const e of eps.sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime())) {
        if (e.releaseDate.toISOString().slice(0, 10) < sinceDay) continue;
        const at = e.releaseDate.getTime();
        newest = Math.max(newest, at);
        if (isClip(e.durationSeconds)) {
          result.ignored++;
          continue;
        }
        result.found++;
        const [exists] = await db().select({ id: episodes.id }).from(episodes).where(eq(episodes.spotifyEpisodeId, e.id));
        if (exists) continue;

        const twin = await findTwin(show.id, show.name, { title: e.name, publishedAt: at, durationSeconds: e.durationSeconds }, "youtube-only");
        if (twin) {
          await db().update(episodes).set({ spotifyEpisodeId: e.id, spotifyUrl: e.url }).where(eq(episodes.id, twin.id));
          result.merged++;
          continue;
        }
        const c = classify(e.durationSeconds);
        await insertEpisode(
          {
            showId: show.id,
            spotifyEpisodeId: e.id,
            title: e.name,
            description: e.description,
            publishedAt: e.releaseDate,
            durationSeconds: e.durationSeconds,
            spotifyUrl: e.url,
            canonicalKey: canonicalKey(e.name, at, show.name),
            analysisDepth: "metadata", // no audio from Spotify: title and description only
            status: c.status,
            statusNote: c.note,
          },
          null,
        );
      }
    } catch (e) {
      errors.push(`Spotify: ${errMsg(e)}`);
      await logEvent("error", "show", `Spotify check failed: ${errMsg(e)}`, { id: show.id, label: show.name });
    }
  }

  const bothFailed = errors.length > 0 && errors.length >= (hasYoutube ? 1 : 0) + (hasSpotify ? 1 : 0);
  await db()
    .update(shows)
    .set({
      lastDiscoveredAt: new Date(),
      lastSeenPublishedAt: newest ? new Date(newest) : show.lastSeenPublishedAt,
      lastError: errors.length ? errors.join(" | ").slice(0, 400) : null,
      failureCount: errors.length ? show.failureCount + 1 : 0,
    })
    .where(eq(shows.id, show.id));
  if (bothFailed) throw new Error(errors.join(" | "));
  if (result.inserted || result.merged || result.ignored) {
    await logEvent(
      "info",
      "show",
      `Discovered ${result.inserted} new ${result.inserted === 1 ? "episode" : "episodes"}${result.merged ? `, merged ${result.merged}` : ""}${result.ignored ? `, ignored ${result.ignored} short clip${result.ignored === 1 ? "" : "s"}` : ""}.`,
      { id: show.id, label: show.name },
    );
  }
  return result;
}

/** Find the same episode on the other platform: same show, within 72h, similar title and length. */
async function findTwin(
  showId: string,
  showName: string,
  incoming: { title: string; publishedAt: number; durationSeconds: number | null },
  want: "spotify-only" | "youtube-only",
) {
  const rows = await db()
    .select()
    .from(episodes)
    .where(
      and(
        eq(episodes.showId, showId),
        between(episodes.publishedAt, new Date(incoming.publishedAt - H72), new Date(incoming.publishedAt + H72)),
        want === "spotify-only" ? isNull(episodes.youtubeVideoId) : isNull(episodes.spotifyEpisodeId),
      ),
    );
  return (
    rows.find((r) => {
      if (want === "spotify-only" && !r.spotifyEpisodeId) return false;
      if (want === "youtube-only" && !r.youtubeVideoId) return false;
      return isSameEpisode({ title: r.title, publishedAt: r.publishedAt.getTime(), durationSeconds: r.durationSeconds }, incoming, showName);
    }) ?? null
  );
}
