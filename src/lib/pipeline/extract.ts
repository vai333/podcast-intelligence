// Gemini extraction for one episode (spec section 7).
//  - video mode: pass the public YouTube URL straight to Gemini (we never download anything)
//  - metadata mode: title + description only, always labelled low confidence
//  - if Gemini cannot process the video, fall back to metadata instead of failing
import { eq } from "drizzle-orm";
import { generateJson, RateLimitedError, VideoUnavailableError, videoPart } from "@/lib/ai/gemini";
import { buildExtractionPrompt } from "@/lib/ai/prompts";
import { ExtractionResult, extractionResponseSchema } from "@/lib/ai/schemas";
import { db } from "@/lib/db/client";
import { episodeGuests, episodeSponsors, episodeTopics, episodes, extractions, shows } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { addUsage, getUsage, istDay } from "@/lib/usage";
import { addDaysISO, startOfDayIST } from "@/lib/time";
import { clearExtraction, upsertGuest, upsertSponsor, upsertTopic } from "./entities";
import { logEvent } from "./log";
import { DeferJob } from "./queue";
import { getSettings } from "./settings";

const EST_TOKENS_PER_SECOND = 48;

export type ExtractOutcome = "extracted" | "skipped";

const nextIstMidnight = () => new Date(startOfDayIST(addDaysISO(istDay(), 1)).getTime() + 5 * 60_000);

export async function extractEpisode(episodeId: string, opts: { force?: boolean } = {}): Promise<ExtractOutcome> {
  const [row] = await db()
    .select({ ep: episodes, showName: shows.name })
    .from(episodes)
    .innerJoin(shows, eq(shows.id, episodes.showId))
    .where(eq(episodes.id, episodeId));
  if (!row) return "skipped";
  const { ep, showName } = row;
  if (ep.status === "extracted" && !opts.force) return "skipped";
  if (ep.status === "skipped" && !opts.force) return "skipped";

  const settings = await getSettings();
  const minutes = ep.durationSeconds ? Math.round(ep.durationSeconds / 60) : null;
  if (minutes !== null && minutes > settings.maxEpisodeMinutes) {
    await db().update(episodes).set({ status: "skipped", statusNote: `Longer than ${settings.maxEpisodeMinutes} min (limit from Settings).` }).where(eq(episodes.id, ep.id));
    await logEvent("warn", "episode", `Skipped: longer than ${settings.maxEpisodeMinutes} min`, { id: ep.id, label: ep.title });
    return "skipped";
  }

  // Daily cost guard: leave the job pending until tomorrow instead of failing it.
  const doneToday = await getUsage(istDay(), "gemini_episodes");
  if (doneToday >= env().GEMINI_DAILY_EPISODE_LIMIT) {
    throw new DeferJob(`Daily limit of ${env().GEMINI_DAILY_EPISODE_LIMIT} episodes reached`, nextIstMidnight());
  }

  const ctx = { showName, title: ep.title, description: ep.description, durationMinutes: minutes };
  let depth: "video" | "metadata" = ep.youtubeUrl && ep.analysisDepth === "video" ? "video" : "metadata";
  // Rough size of a video request (about 48 tokens per second at our frame sampling). Too big for the
  // per-minute token limit would mean retrying forever, so analyse those from title and description.
  if (depth === "video" && ep.durationSeconds && ep.durationSeconds * EST_TOKENS_PER_SECOND > env().GEMINI_MAX_VIDEO_TOKENS) {
    depth = "metadata";
    await logEvent("warn", "episode", `Too long for the video token limit (about ${Math.round((ep.durationSeconds * EST_TOKENS_PER_SECOND) / 1000)}K tokens); analysed from title and description.`, { id: ep.id, label: ep.title });
  }

  const run = (mode: "video" | "metadata") =>
    generateJson({
      parts:
        mode === "video" && ep.youtubeUrl
          ? [videoPart(ep.youtubeUrl), { text: buildExtractionPrompt({ ...ctx, mode: "video" }) }]
          : [{ text: buildExtractionPrompt({ ...ctx, mode: "metadata" }) }],
      responseSchema: extractionResponseSchema,
      schema: ExtractionResult,
      video: mode === "video",
    });

  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run(depth);
  } catch (e) {
    if (e instanceof RateLimitedError) {
      throw new DeferJob(e.daily ? "Gemini daily quota reached on every model" : e.message, new Date(Date.now() + e.retryAfterSec * 1000), e.daily);
    }
    if (e instanceof VideoUnavailableError && depth === "video") {
      await logEvent("warn", "episode", "Video not available to Gemini; fell back to title and description", { id: ep.id, label: ep.title });
      depth = "metadata";
      try {
        result = await run("metadata");
      } catch (e2) {
        if (e2 instanceof RateLimitedError) throw new DeferJob(e2.daily ? "Gemini daily quota reached on every model" : e2.message, new Date(Date.now() + e2.retryAfterSec * 1000), e2.daily);
        throw e2;
      }
    } else {
      throw e;
    }
  }

  const data = result.data;
  const guestList = data.guests.filter((g) => g.role === "guest");
  const avgConf = guestList.length ? guestList.reduce((s, g) => s + g.confidence, 0) / guestList.length : 0.7;
  const confidence = depth === "metadata" ? "low" : avgConf >= 0.8 ? "high" : "medium";

  await db().transaction(async (tx) => {
    await clearExtraction(tx, ep.id);
    for (const g of data.guests) {
      const gid = await upsertGuest(tx, g.name, g.title_or_company);
      if (gid) await tx.insert(episodeGuests).values({ episodeId: ep.id, guestId: gid, role: g.role }).onConflictDoNothing();
    }
    for (const t of data.topics) {
      const tid = await upsertTopic(tx, t.label);
      if (tid) await tx.insert(episodeTopics).values({ episodeId: ep.id, topicId: tid, weight: t.weight }).onConflictDoNothing();
    }
    for (const s of data.sponsors) {
      // Metadata mode can only know about the description, never the spoken audio.
      const sid = await upsertSponsor(tx, s.name, ep.publishedAt);
      if (sid) {
        await tx.insert(episodeSponsors).values({
          episodeId: ep.id,
          sponsorId: sid,
          product: s.product,
          placement: depth === "metadata" ? "description_link" : s.placement,
          evidence: s.evidence,
          timestampSeconds: s.timestamp_seconds,
          source: depth === "metadata" ? "description" : s.source,
        });
      }
    }
    const raw = { result: data, usage: result.usage, depth, summary: data.summary };
    await tx
      .insert(extractions)
      .values({ episodeId: ep.id, model: result.model, rawJson: raw, confidence })
      .onConflictDoUpdate({ target: extractions.episodeId, set: { model: result.model, rawJson: raw, confidence, createdAt: new Date() } });
    await tx.update(episodes).set({ status: "extracted", analysisDepth: depth, statusNote: null }).where(eq(episodes.id, ep.id));
  });

  await addUsage(istDay(), "gemini_episodes", 1);
  return "extracted";
}

/** Called when a job runs out of attempts, so the episode shows up as failed on the Episodes page. */
export async function markEpisodeFailed(episodeId: string, reason: string): Promise<void> {
  await db().update(episodes).set({ status: "failed", statusNote: reason.slice(0, 300) }).where(eq(episodes.id, episodeId));
  await logEvent("error", "episode", `Extraction failed: ${reason}`, { id: episodeId });
}
