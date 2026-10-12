// Monday view refresh (spec 8.1 step 2): append a new view_snapshots row per episode. Never overwrite.
import { and, gt, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { episodes, viewSnapshots } from "@/lib/db/schema";
import * as yt from "@/lib/sources/youtube";
import { errMsg, logEvent } from "./log";

export async function refreshViews(lookbackDays = 35): Promise<{ checked: number; updated: number }> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const rows = await db()
    .select({ id: episodes.id, videoId: episodes.youtubeVideoId, isDemo: episodes.isDemo })
    .from(episodes)
    .where(and(isNotNull(episodes.youtubeVideoId), gt(episodes.publishedAt, since)));
  const real = rows.filter((r) => !r.isDemo && r.videoId);
  let updated = 0;
  try {
    const videos = await yt.getVideos(real.map((r) => r.videoId as string));
    const byId = new Map(videos.map((v) => [v.id, v]));
    for (const r of real) {
      const v = byId.get(r.videoId as string);
      if (!v || v.views === null) continue;
      await db().insert(viewSnapshots).values({ episodeId: r.id, views: v.views, likes: v.likes, comments: v.comments });
      updated++;
    }
  } catch (e) {
    await logEvent("warn", "api", `View refresh failed: ${errMsg(e)}`);
  }
  return { checked: real.length, updated };
}
