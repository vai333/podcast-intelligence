// npm run seed: adds the 10 default shows (spec 6.2), resolved through the same search code the dashboard uses.
// Prints the matches so a human can confirm them. Shows already in the database are left alone.
import { isNull } from "drizzle-orm";
import { closeDb, db } from "@/lib/db/client";
import { shows } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { printResolved, resolveSeedShows } from "./lib/resolve";

(async () => {
  const resolved = await resolveSeedShows();
  printResolved(resolved);
  const existing = await db().select({ name: shows.name }).from(shows).where(isNull(shows.activeTo));
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  // Optional one-time backfill for the initial seed only. Swaps made later through the dashboard never backfill.
  const from = new Date(Date.now() - env().SEED_BACKFILL_DAYS * 86_400_000);
  let added = 0;
  for (const r of resolved) {
    if (have.has(r.name.toLowerCase())) continue;
    const c = r.channel;
    await db().insert(shows).values({
      name: r.name,
      description: (c?.description ?? "").slice(0, 500),
      artworkUrl: c?.thumbnailUrl ?? r.spotify?.imageUrl ?? null,
      youtubeChannelId: c?.id ?? null,
      youtubeUploadsPlaylistId: c?.uploadsPlaylistId ?? null,
      youtubeHandle: c?.handle ?? null,
      youtubeSubscribers: c?.subscribers ?? null,
      spotifyShowId: r.spotify?.id ?? null,
      activeFrom: from,
      lastSeenPublishedAt: from,
      lastError: c || r.spotify ? null : "Nothing to check: no YouTube channel or Spotify show is linked.",
    });
    added++;
  }
  console.log(`Added ${added} show(s); ${resolved.length - added} already present.`);
  await closeDb();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
