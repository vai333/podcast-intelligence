// Dry run: shows what the YouTube search would pick for each of the 10 seed shows, without writing anything.
import { SEED_SHOWS } from "./seed-shows";
import { bestChannelFor, searchYoutubeCached } from "@/lib/services/show-search";
import { nameSimilarity } from "@/lib/sources/match";
import { closeDb } from "@/lib/db/client";

(async () => {
  for (const { name, query } of SEED_SHOWS) {
    const channels = await searchYoutubeCached(query ?? name);
    const best = bestChannelFor(name, channels);
    console.log(`\n${name}`);
    for (const c of channels) {
      console.log(`  ${c === best ? "->" : "  "} ${c.title} | ${c.handle ?? "-"} | ${c.subscribers} subs | ${c.videoCount} videos | sim ${nameSimilarity(name, c.title).toFixed(2)} | ${c.id}`);
    }
    if (!best) console.log("  (no confident match)");
  }
  await closeDb();
})().catch((e) => { console.error(e.message); process.exit(1); });
