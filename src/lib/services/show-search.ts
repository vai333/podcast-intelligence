// Finds candidate shows on YouTube and Spotify and pairs them by name (spec 6.1).
// YouTube channel searches cost 100 quota units, so results are cached in Neon for 24 hours.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { searchCache } from "@/lib/db/schema";
import type { ShowCandidate } from "@/lib/data/types";
import { spotifyEnabled } from "@/lib/env";
import { nameSimilarity } from "@/lib/sources/match";
import * as sp from "@/lib/sources/spotify";
import * as yt from "@/lib/sources/youtube";

const TTL_MS = 24 * 3_600_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const [hit] = await db().select().from(searchCache).where(eq(searchCache.key, key));
  if (hit && hit.expiresAt.getTime() > Date.now()) return hit.payload as T;
  const value = await fn();
  await db()
    .insert(searchCache)
    .values({ key, payload: value as never, expiresAt: new Date(Date.now() + TTL_MS) })
    .onConflictDoUpdate({ target: searchCache.key, set: { payload: value as never, expiresAt: new Date(Date.now() + TTL_MS) } });
  return value;
}

export const searchYoutubeCached = (q: string) => cached(`yt:channels:${q.trim().toLowerCase()}`, () => yt.searchChannels(q.trim(), 6));
export const searchSpotifyCached = (q: string) => cached(`sp:shows:${q.trim().toLowerCase()}`, () => sp.searchShows(q.trim(), 6));

/**
 * Best YouTube channel for a show name. Name similarity matters most, popularity breaks ties
 * (an exact-name channel with 100 subscribers should not beat the real 100K-subscriber show).
 */
export function bestChannelFor(name: string, channels: yt.YtChannel[]): yt.YtChannel | null {
  const scored = channels
    .filter((c) => c.videoCount > 0)
    .map((c) => {
      const sim = nameSimilarity(name, c.title);
      return { c, sim, score: sim * 0.8 + Math.min(Math.log10(c.subscribers + 1) / 6, 1) * 0.2 };
    })
    .filter((x) => x.sim >= 0.6)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.c ?? null;
}

const toYoutube = (c: yt.YtChannel) => ({ channelId: c.id, handle: c.handle ?? "", subscribers: c.subscribers });
const toSpotify = (s: sp.SpShow) => ({ showId: s.id, publisher: s.publisher });

function candidate(c: yt.YtChannel | null, s: sp.SpShow | null): ShowCandidate {
  const both = !!c && !!s;
  const sim = both ? nameSimilarity(c.title, s.name) : 0;
  let matchNote: string;
  let matchConfidence: "high" | "check" = "high";
  if (both) {
    if (sim >= 0.8) matchNote = "Names match closely on both platforms.";
    else {
      matchNote = "Check this pair: the YouTube and Spotify names differ.";
      matchConfidence = "check";
    }
  } else if (c) {
    matchNote = "Found on YouTube.";
    if (!spotifyEnabled()) matchConfidence = "high";
  } else {
    matchNote = "Only found on Spotify. No YouTube channel matched.";
  }
  const base = c ?? s!;
  return {
    id: `cand_${c ? c.id : s!.id}`,
    name: c?.title ?? s!.name,
    description: ((c?.description || s?.description) ?? "").slice(0, 280),
    artworkUrl: c?.thumbnailUrl ?? s?.imageUrl ?? null,
    youtube: c ? toYoutube(c) : null,
    spotify: s ? toSpotify(s) : null,
    matchNote,
    matchConfidence,
    ...(base ? {} : {}),
  };
}

/** Pairs YouTube channels with Spotify shows by name; unpaired ones stay as single-platform candidates. */
export function pairCandidates(channels: yt.YtChannel[], shows: sp.SpShow[]): ShowCandidate[] {
  const usedShows = new Set<string>();
  const out: ShowCandidate[] = [];
  for (const c of channels.filter((x) => x.videoCount > 0)) {
    let best: sp.SpShow | null = null;
    let bestSim = 0;
    for (const s of shows) {
      if (usedShows.has(s.id)) continue;
      const sim = nameSimilarity(c.title, s.name);
      if (sim > bestSim) {
        best = s;
        bestSim = sim;
      }
    }
    if (best && bestSim >= 0.6) {
      usedShows.add(best.id);
      out.push(candidate(c, best));
    } else out.push(candidate(c, null));
  }
  for (const s of shows) if (!usedShows.has(s.id)) out.push(candidate(null, s));
  return out;
}

/** Accepts a name, a YouTube channel link/handle, or a Spotify show link. */
export async function searchShowCandidates(q: string): Promise<ShowCandidate[]> {
  const query = q.trim();
  if (!query) return [];

  const spId = sp.parseSpotifyShowUrl(query);
  if (spId) {
    if (!spotifyEnabled()) return [];
    const show = await sp.getShow(spId);
    if (!show) return [];
    const ytMatches = await searchYoutubeCached(show.name).catch(() => []);
    return [candidate(bestChannelFor(show.name, ytMatches), show)];
  }

  if (/youtube\.com|youtu\.be|^@/i.test(query)) {
    const ch = await yt.resolveChannelInput(query);
    if (!ch) return [];
    const shows = spotifyEnabled() ? await searchSpotifyCached(ch.title).catch(() => []) : [];
    const match = shows.map((s) => ({ s, sim: nameSimilarity(ch.title, s.name) })).sort((a, b) => b.sim - a.sim)[0];
    return [candidate(ch, match && match.sim >= 0.6 ? match.s : null)];
  }

  const [channels, shows] = await Promise.all([
    searchYoutubeCached(query).catch(() => [] as yt.YtChannel[]),
    spotifyEnabled() ? searchSpotifyCached(query).catch(() => [] as sp.SpShow[]) : Promise.resolve([] as sp.SpShow[]),
  ]);
  return pairCandidates(channels, shows).slice(0, 6);
}
