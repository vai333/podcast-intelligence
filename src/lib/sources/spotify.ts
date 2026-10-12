// Spotify Web API client (client-credentials flow). Official API only.
// Optional: when SPOTIFY_CLIENT_ID/SECRET are not set, spotifyEnabled() is false and callers skip Spotify.
import { z } from "zod";
import { env, spotifyEnabled } from "@/lib/env";
import { fetchJson } from "@/lib/http";

const API = "https://api.spotify.com/v1";
const MARKET = "IN";

export interface SpShow {
  id: string;
  name: string;
  description: string;
  publisher: string;
  imageUrl: string | null;
  url: string;
}

export interface SpEpisode {
  id: string;
  name: string;
  description: string;
  /** Spotify only gives a release date, so this is midnight UTC of that date. */
  releaseDate: Date;
  durationSeconds: number;
  url: string;
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const e = env();
  const basic = Buffer.from(`${e.SPOTIFY_CLIENT_ID}:${e.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const raw = await fetchJson("https://accounts.spotify.com/api/token", {
    service: "Spotify",
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const t = z.object({ access_token: z.string(), expires_in: z.number() }).parse(raw);
  token = { value: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
  return token.value;
}

async function get(path: string, params: Record<string, string> = {}): Promise<unknown> {
  if (!spotifyEnabled()) throw new Error("Spotify is not configured");
  const qs = new URLSearchParams(params);
  return fetchJson(`${API}${path}${qs.size ? `?${qs}` : ""}`, { service: "Spotify", headers: { Authorization: `Bearer ${await accessToken()}` } });
}

const ShowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  publisher: z.string().default(""),
  images: z.array(z.object({ url: z.string() })).default([]),
  external_urls: z.object({ spotify: z.string() }).partial().default({}),
});

const toShow = (s: z.infer<typeof ShowSchema>): SpShow => ({
  id: s.id,
  name: s.name,
  description: s.description,
  publisher: s.publisher,
  imageUrl: s.images[1]?.url ?? s.images[0]?.url ?? null,
  url: s.external_urls.spotify ?? `https://open.spotify.com/show/${s.id}`,
});

export async function searchShows(q: string, limit = 6): Promise<SpShow[]> {
  const raw = await get("/search", { type: "show", market: MARKET, q, limit: String(limit) });
  const parsed = z.object({ shows: z.object({ items: z.array(ShowSchema.nullable()) }) }).parse(raw);
  return parsed.shows.items.filter((x): x is NonNullable<typeof x> => !!x).map(toShow);
}

export async function getShow(id: string): Promise<SpShow | null> {
  try {
    return toShow(ShowSchema.parse(await get(`/shows/${id}`, { market: MARKET })));
  } catch {
    return null;
  }
}

export const parseSpotifyShowUrl = (s: string): string | null => /open\.spotify\.com\/(?:intl-[a-z]+\/)?show\/([A-Za-z0-9]+)/.exec(s)?.[1] ?? null;

const EpisodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  release_date: z.string(),
  duration_ms: z.number(),
  external_urls: z.object({ spotify: z.string() }).partial().default({}),
});

/** Newest 20 episodes of a show (Spotify returns newest first). */
export async function getEpisodes(showId: string, limit = 20): Promise<SpEpisode[]> {
  const raw = await get(`/shows/${showId}/episodes`, { market: MARKET, limit: String(limit) });
  const parsed = z.object({ items: z.array(EpisodeSchema.nullable()) }).parse(raw);
  return parsed.items
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      releaseDate: new Date(e.release_date.length === 4 ? `${e.release_date}-01-01` : e.release_date.length === 7 ? `${e.release_date}-01` : e.release_date),
      durationSeconds: Math.round(e.duration_ms / 1000),
      url: e.external_urls.spotify ?? `https://open.spotify.com/episode/${e.id}`,
    }));
}
