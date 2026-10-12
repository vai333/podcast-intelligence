// Resolves the 10 seed shows to real YouTube channels (and Spotify shows when Spotify is configured).
import { spotifyEnabled } from "@/lib/env";
import { bestChannelFor, searchSpotifyCached, searchYoutubeCached } from "@/lib/services/show-search";
import { nameSimilarity } from "@/lib/sources/match";
import type { YtChannel } from "@/lib/sources/youtube";
import type { SpShow } from "@/lib/sources/spotify";
import { SEED_SHOWS } from "../seed-shows";

export interface Resolved {
  name: string;
  channel: YtChannel | null;
  spotify: SpShow | null;
  note: string;
}

export async function resolveSeedShows(): Promise<Resolved[]> {
  const out: Resolved[] = [];
  for (const s of SEED_SHOWS) {
    let channel: YtChannel | null = null;
    let note = "";
    try {
      channel = bestChannelFor(s.match ?? s.name, await searchYoutubeCached(s.query ?? s.name));
    } catch (e) {
      note = `YouTube search failed: ${e instanceof Error ? e.message : e}`;
    }
    let spotify: SpShow | null = null;
    if (spotifyEnabled()) {
      try {
        spotify = (await searchSpotifyCached(s.name)).map((x) => ({ x, sim: nameSimilarity(s.name, x.name) })).filter((r) => r.sim >= 0.8).sort((a, b) => b.sim - a.sim)[0]?.x ?? null;
      } catch {
        /* optional */
      }
    }
    if (!note) note = channel ? "ok" : "no confident YouTube match: link one from the Shows page";
    out.push({ name: s.name, channel, spotify, note });
  }
  return out;
}

export function printResolved(rs: Resolved[]) {
  console.log("\nResolved shows (please confirm these are the right ones):\n");
  for (const r of rs) {
    const c = r.channel;
    console.log(
      `  ${r.name.padEnd(32)} ${c ? `${c.title} | ${c.handle ?? "-"} | ${c.subscribers.toLocaleString("en-IN")} subs | ${c.id}` : "(not found on YouTube)"}${r.spotify ? ` | Spotify: ${r.spotify.name}` : ""}`,
    );
    if (r.note !== "ok") console.log(`  ${"".padEnd(32)} ! ${r.note}`);
  }
  console.log("");
}
