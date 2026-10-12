// Builds an in-memory World from Neon. The dataset is small (hundreds of episodes a year), so loading it
// and reusing the shared derive/compose code keeps the real app and the mock behaving identically.
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  briefs,
  cronRuns,
  episodeGuests,
  episodeSponsors,
  episodeTopics,
  episodes,
  guestAliases,
  guests,
  ingestionLog,
  jobs,
  shows,
  sponsorAliases,
  sponsors,
  topics,
} from "@/lib/db/schema";
import { getSettings } from "@/lib/pipeline/settings";
import type { WEpisode, WLog, WShow, World } from "../mock/world";

const DAY = 86_400_000;
type ShowRow = typeof shows.$inferSelect;

export const showGroupKey = (r: Pick<ShowRow, "youtubeChannelId" | "spotifyShowId" | "name">) =>
  r.youtubeChannelId ?? r.spotifyShowId ?? `name:${r.name.toLowerCase()}`;

export interface DbWorld extends World {
  /** group id -> its rows, newest first (the first row is the active one when the show is active) */
  rowsByGroup: Map<string, ShowRow[]>;
  groupOfRow: Map<string, string>;
}

export async function loadWorld(now = Date.now()): Promise<DbWorld> {
  const [showRows, epRows, viewRows, guestLinks, topicLinks, sponsorLinks, guestRows, aliasRows, sponsorRows, sponsorAliasRows, logRows, briefRows, settingsVal, running, lastWorker] =
    await Promise.all([
      db().select().from(shows).orderBy(shows.activeFrom),
      db().select().from(episodes).orderBy(desc(episodes.publishedAt)),
      db().execute(sql`select distinct on (episode_id) episode_id, views from view_snapshots order by episode_id, captured_at desc`),
      db().select({ episodeId: episodeGuests.episodeId, guestId: episodeGuests.guestId }).from(episodeGuests).where(eq(episodeGuests.role, "guest")),
      db().select({ episodeId: episodeTopics.episodeId, label: topics.canonicalLabel }).from(episodeTopics).innerJoin(topics, eq(topics.id, episodeTopics.topicId)),
      db().select().from(episodeSponsors),
      db().select().from(guests),
      db().select().from(guestAliases),
      db().select().from(sponsors),
      db().select().from(sponsorAliases),
      db().select().from(ingestionLog).orderBy(desc(ingestionLog.createdAt)).limit(200),
      db().select({ weekStart: briefs.weekStart, sentAt: briefs.sentAt }).from(briefs).orderBy(briefs.weekStart),
      getSettings(),
      db().select({ id: jobs.id }).from(jobs).where(eq(jobs.status, "running")).limit(1),
      db().select().from(cronRuns).where(eq(cronRuns.name, "worker")).orderBy(desc(cronRuns.startedAt)).limit(1),
    ]);


  // ---- shows: group rows (one row per tracking period) into one show with several intervals
  const byGroup = new Map<string, ShowRow[]>();
  for (const r of showRows) byGroup.set(showGroupKey(r), [...(byGroup.get(showGroupKey(r)) ?? []), r]);
  const groupOfRow = new Map<string, string>();
  const rowsByGroup = new Map<string, ShowRow[]>();
  const worldShows: WShow[] = [];

  const lastEpByRow = new Map<string, number>();
  for (const e of epRows) lastEpByRow.set(e.showId, Math.max(lastEpByRow.get(e.showId) ?? 0, e.publishedAt.getTime()));

  for (const rows of byGroup.values()) {
    const newestFirst = [...rows].sort((a, b) => b.activeFrom.getTime() - a.activeFrom.getTime());
    const latest = newestFirst[0];
    const gid = latest.id;
    rowsByGroup.set(gid, newestFirst);
    for (const r of rows) groupOfRow.set(r.id, gid);
    const active = latest.activeTo === null;
    const lastEp = Math.max(0, ...rows.map((r) => lastEpByRow.get(r.id) ?? 0));
    const monitoredDays = (now - latest.activeFrom.getTime()) / DAY;
    let health: WShow["health"] = "ok";
    let healthNote: string | null = null;
    if (active && latest.lastError) {
      health = "error";
      healthNote = latest.lastError;
    } else if (active && monitoredDays > 21 && (!lastEp || now - lastEp > 21 * DAY)) {
      health = "quiet";
    }
    worldShows.push({
      id: gid,
      name: latest.name,
      description: latest.description,
      handle: latest.youtubeHandle ?? "",
      subscribers: latest.youtubeSubscribers ?? 0,
      hasYoutube: !!latest.youtubeChannelId,
      hasSpotify: !!latest.spotifyShowId,
      health,
      healthNote,
      intervals: rows.map((r) => ({ from: r.activeFrom.getTime(), to: r.activeTo ? r.activeTo.getTime() : null })),
      channelId: latest.youtubeChannelId,
      spotifyId: latest.spotifyShowId,
      artworkUrl: latest.artworkUrl,
    });
  }

  // ---- episodes with their extracted facts
  const views = new Map<string, number>((viewRows.rows as { episode_id: string; views: number }[]).map((r) => [r.episode_id, r.views]));
  const gByEp = new Map<string, string[]>();
  for (const l of guestLinks) gByEp.set(l.episodeId, [...(gByEp.get(l.episodeId) ?? []), l.guestId]);
  const tByEp = new Map<string, string[]>();
  for (const l of topicLinks) tByEp.set(l.episodeId, [...(tByEp.get(l.episodeId) ?? []), l.label]);
  const sByEp = new Map<string, typeof sponsorLinks>();
  for (const l of sponsorLinks) sByEp.set(l.episodeId, [...(sByEp.get(l.episodeId) ?? []), l]);

  const worldEpisodes: WEpisode[] = epRows.map((e) => ({
    id: e.id,
    showId: groupOfRow.get(e.showId) ?? e.showId,
    title: e.title,
    publishedAt: e.publishedAt.getTime(),
    durationMin: e.durationSeconds ? Math.round(e.durationSeconds / 60) : 0,
    views: e.youtubeVideoId ? (views.get(e.id) ?? null) : null,
    depth: e.analysisDepth,
    status: e.status,
    statusNote: e.statusNote,
    youtubeUrl: e.youtubeUrl,
    spotifyUrl: e.spotifyUrl,
    guestKeys: gByEp.get(e.id) ?? [],
    topics: tByEp.get(e.id) ?? [],
    sponsors: (sByEp.get(e.id) ?? []).map((m) => ({
      sponsorKey: m.sponsorId,
      product: m.product ?? "",
      placement: m.placement,
      evidence: m.evidence,
      timestampSeconds: m.timestampSeconds,
      source: m.source,
    })),
  }));

  // ---- guests (people who appeared as guests at least once) and sponsors
  const aliasByGuest = new Map<string, string[]>();
  for (const a of aliasRows) aliasByGuest.set(a.guestId, [...(aliasByGuest.get(a.guestId) ?? []), a.alias]);
  const used = new Set(worldEpisodes.flatMap((e) => e.guestKeys));
  const worldGuests = guestRows
    .filter((g) => used.has(g.id))
    .map((g) => ({ key: g.id, name: g.canonicalName, company: g.titleOrCompany, fame: 1, aliases: aliasByGuest.get(g.id) ?? [] }));

  const aliasBySponsor = new Map<string, string[]>();
  for (const a of sponsorAliasRows) aliasBySponsor.set(a.sponsorId, [...(aliasBySponsor.get(a.sponsorId) ?? []), a.alias]);
  const worldSponsors = sponsorRows.map((s) => ({ key: s.id, name: s.canonicalName, aliases: aliasBySponsor.get(s.id) ?? [] }));

  const logs: WLog[] = logRows.map((l) => ({
    id: l.id,
    at: l.createdAt.getTime(),
    level: l.level,
    scope: l.scope,
    message: l.message,
    refLabel: l.refLabel,
  }));

  const lastEpisodeCreated = epRows.reduce((m, e) => Math.max(m, e.createdAt.getTime()), 0);
  const lastWorkerAt = lastWorker[0]?.finishedAt?.getTime() ?? lastWorker[0]?.startedAt.getTime() ?? 0;

  return {
    scenario: "full",
    now,
    shows: worldShows,
    episodes: worldEpisodes,
    guests: worldGuests,
    sponsors: worldSponsors,
    logs,
    briefWeeks: briefRows.map((b) => b.weekStart),
    firstWeek: false,
    lastDataAt: Math.max(lastEpisodeCreated, lastWorkerAt),
    sentWeeks: new Set(briefRows.filter((b) => b.sentAt).map((b) => b.weekStart)),
    workerRunning: running.length > 0,
    lastWorkerAt,
    settings: {
      maxActiveShows: settingsVal.maxActiveShows,
      minEpisodeMinutes: settingsVal.minEpisodeMinutes,
      maxEpisodeMinutes: settingsVal.maxEpisodeMinutes,
      trendLookbackDays: settingsVal.trendLookbackDays,
      adminEmail: settingsVal.adminEmail,
    },
    rowsByGroup,
    groupOfRow,
  };
}
