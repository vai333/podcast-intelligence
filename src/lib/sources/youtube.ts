// YouTube Data API v3 client. Official API only: no scraping, no transcripts.
// Quota costs: search.list = 100 units, everything else here = 1 unit per call.
import { z } from "zod";
import { env } from "@/lib/env";
import { fetchJson, HttpError } from "@/lib/http";
import { addUsage, getUsage, youtubeDay } from "@/lib/usage";

const BASE = "https://www.googleapis.com/youtube/v3";
export const YT_DAILY_QUOTA = 10_000;
/** Stop discovery before we exhaust the day's quota. */
export const YT_SOFT_LIMIT = 9_400;

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

async function call(path: string, params: Record<string, string>, cost: number): Promise<unknown> {
  const used = await getUsage(youtubeDay(), "youtube_units");
  if (used + cost > YT_SOFT_LIMIT) throw new QuotaError(`YouTube quota nearly used up (${used} of ${YT_DAILY_QUOTA} units today)`);
  const qs = new URLSearchParams({ ...params, key: env().YOUTUBE_API_KEY });
  const data = await fetchJson(`${BASE}/${path}?${qs}`, { service: "YouTube" });
  await addUsage(youtubeDay(), "youtube_units", cost);
  return data;
}

/* ------------------------------ types ------------------------------ */

export interface YtChannel {
  id: string;
  title: string;
  description: string;
  handle: string | null;
  subscribers: number;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string;
  videoCount: number;
}

export interface YtVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  durationSeconds: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export interface YtUpload {
  videoId: string;
  publishedAt: Date;
}

const Thumbs = z.object({ default: z.object({ url: z.string() }).optional(), medium: z.object({ url: z.string() }).optional() }).partial().optional();

const ChannelsResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ title: z.string(), description: z.string().default(""), customUrl: z.string().optional(), thumbnails: Thumbs }),
        contentDetails: z.object({ relatedPlaylists: z.object({ uploads: z.string().optional() }) }).optional(),
        statistics: z.object({ subscriberCount: z.string().optional(), videoCount: z.string().optional() }).optional(),
      }),
    )
    .default([]),
});

const SearchResponse = z.object({ items: z.array(z.object({ id: z.object({ channelId: z.string().optional() }) })).default([]) });

const PlaylistResponse = z.object({
  items: z.array(z.object({ contentDetails: z.object({ videoId: z.string(), videoPublishedAt: z.string().optional() }) })).default([]),
  nextPageToken: z.string().optional(),
});

const VideosResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ title: z.string(), description: z.string().default(""), publishedAt: z.string() }),
        contentDetails: z.object({ duration: z.string() }),
        statistics: z.object({ viewCount: z.string().optional(), likeCount: z.string().optional(), commentCount: z.string().optional() }).optional(),
      }),
    )
    .default([]),
});

/* ------------------------------ helpers ------------------------------ */

/** "PT1H2M3S" -> seconds. */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + +(m[4] ?? 0);
}

const num = (s?: string) => (s === undefined ? null : Number.isFinite(Number(s)) ? Number(s) : null);

function toChannel(it: z.infer<typeof ChannelsResponse>["items"][number]): YtChannel | null {
  const uploads = it.contentDetails?.relatedPlaylists.uploads;
  if (!uploads) return null;
  return {
    id: it.id,
    title: it.snippet.title,
    description: it.snippet.description,
    handle: it.snippet.customUrl?.startsWith("@") ? it.snippet.customUrl : it.snippet.customUrl ? `@${it.snippet.customUrl}` : null,
    subscribers: num(it.statistics?.subscriberCount) ?? 0,
    thumbnailUrl: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url ?? null,
    uploadsPlaylistId: uploads,
    videoCount: num(it.statistics?.videoCount) ?? 0,
  };
}

/* ------------------------------ channels ------------------------------ */

export async function getChannelsByIds(ids: string[]): Promise<YtChannel[]> {
  if (!ids.length) return [];
  const out: YtChannel[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const raw = await call("channels", { part: "snippet,contentDetails,statistics", id: ids.slice(i, i + 50).join(","), maxResults: "50" }, 1);
    for (const it of ChannelsResponse.parse(raw).items) {
      const c = toChannel(it);
      if (c) out.push(c);
    }
  }
  return out;
}

export async function getChannelByHandle(handle: string): Promise<YtChannel | null> {
  const raw = await call("channels", { part: "snippet,contentDetails,statistics", forHandle: handle.startsWith("@") ? handle : `@${handle}` }, 1);
  const it = ChannelsResponse.parse(raw).items[0];
  return it ? toChannel(it) : null;
}

/** search.list costs 100 units. Callers cache results for 24h (see searchCache). */
export async function searchChannels(query: string, max = 6): Promise<YtChannel[]> {
  const raw = await call("search", { part: "snippet", type: "channel", q: query, maxResults: String(max) }, 100);
  const ids = SearchResponse.parse(raw).items.map((i) => i.id.channelId).filter((x): x is string => !!x);
  return getChannelsByIds(ids);
}

/** Accepts a channel URL (/channel/UC..., /@handle) or a bare handle / channel id. */
export async function resolveChannelInput(input: string): Promise<YtChannel | null> {
  const s = input.trim();
  const idMatch = /\/channel\/(UC[\w-]{20,})/.exec(s) ?? /^(UC[\w-]{20,})$/.exec(s);
  if (idMatch) return (await getChannelsByIds([idMatch[1]]))[0] ?? null;
  const handle = /youtube\.com\/(@[\w.-]+)/.exec(s)?.[1] ?? (/^@[\w.-]+$/.test(s) ? s : null);
  if (handle) return getChannelByHandle(handle);
  return null;
}

/* ------------------------------ uploads ------------------------------ */

/** Newest-first uploads published after `sinceMs`. Pages until it passes `sinceMs` (1 unit per 50 items). */
export async function listUploadsSince(playlistId: string, sinceMs: number, maxPages = 4): Promise<YtUpload[]> {
  const out: YtUpload[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    let raw: unknown;
    try {
      raw = await call("playlistItems", { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) }, 1);
    } catch (e) {
      // An empty or private uploads playlist answers 404; treat as "nothing new".
      if (e instanceof HttpError && e.status === 404) return out;
      throw e;
    }
    const parsed = PlaylistResponse.parse(raw);
    let reachedOld = false;
    for (const it of parsed.items) {
      const at = it.contentDetails.videoPublishedAt ? new Date(it.contentDetails.videoPublishedAt) : null;
      if (at && at.getTime() <= sinceMs) {
        reachedOld = true;
        continue;
      }
      out.push({ videoId: it.contentDetails.videoId, publishedAt: at ?? new Date() });
    }
    if (reachedOld || !parsed.nextPageToken) break;
    pageToken = parsed.nextPageToken;
  }
  return out;
}

export async function getVideos(ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const raw = await call("videos", { part: "snippet,contentDetails,statistics", id: ids.slice(i, i + 50).join(","), maxResults: "50" }, 1);
    for (const v of VideosResponse.parse(raw).items) {
      out.push({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: new Date(v.snippet.publishedAt),
        durationSeconds: parseIsoDuration(v.contentDetails.duration),
        views: num(v.statistics?.viewCount),
        likes: num(v.statistics?.likeCount),
        comments: num(v.statistics?.commentCount),
      });
    }
  }
  return out;
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
