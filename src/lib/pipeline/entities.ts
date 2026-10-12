// Find-or-create for guests, topics and sponsors, with the normalisation rules from spec 7.4.
// Near-matches are NOT auto-merged here; the weekly consolidation step handles those.
import { eq, sql } from "drizzle-orm";
import { normalizeGuestKey, normalizeSponsorKey, normalizeTopicLabel } from "@/lib/ai/normalize";
import { guestAliases, guests, sponsorAliases, sponsors, topicAliases, topics } from "@/lib/db/schema";
import type { Tx } from "@/lib/db/client";

export async function upsertGuest(tx: Tx, name: string, company: string | null): Promise<string | null> {
  const key = normalizeGuestKey(name);
  if (!key) return null;
  const [byKey] = await tx.select().from(guests).where(eq(guests.normalizedKey, key));
  if (byKey) {
    if (!byKey.titleOrCompany && company) await tx.update(guests).set({ titleOrCompany: company }).where(eq(guests.id, byKey.id));
    return byKey.id;
  }
  const [byAlias] = await tx.select({ guestId: guestAliases.guestId }).from(guestAliases).where(eq(guestAliases.alias, key));
  if (byAlias) return byAlias.guestId;
  const canonical = name.trim().replace(/\s+/g, " ");
  await tx.insert(guests).values({ canonicalName: canonical, normalizedKey: key, titleOrCompany: company }).onConflictDoNothing();
  const [created] = await tx.select({ id: guests.id }).from(guests).where(eq(guests.normalizedKey, key));
  return created?.id ?? null;
}

export async function upsertTopic(tx: Tx, label: string): Promise<string | null> {
  const norm = normalizeTopicLabel(label);
  if (norm.length < 3) return null;
  const [byLabel] = await tx.select({ id: topics.id }).from(topics).where(eq(topics.canonicalLabel, norm));
  if (byLabel) return byLabel.id;
  const [byAlias] = await tx.select({ topicId: topicAliases.topicId }).from(topicAliases).where(eq(topicAliases.alias, norm));
  if (byAlias) return byAlias.topicId;
  await tx.insert(topics).values({ canonicalLabel: norm }).onConflictDoNothing();
  const [created] = await tx.select({ id: topics.id }).from(topics).where(eq(topics.canonicalLabel, norm));
  return created?.id ?? null;
}

export async function upsertSponsor(tx: Tx, name: string, seenAt: Date): Promise<string | null> {
  const key = normalizeSponsorKey(name);
  if (key.length < 2) return null;
  const [byKey] = await tx.select().from(sponsors).where(eq(sponsors.normalizedKey, key));
  if (byKey) {
    if (seenAt < byKey.firstSeenAt) await tx.update(sponsors).set({ firstSeenAt: seenAt }).where(eq(sponsors.id, byKey.id));
    return byKey.id;
  }
  const [byAlias] = await tx.select({ sponsorId: sponsorAliases.sponsorId }).from(sponsorAliases).where(eq(sponsorAliases.alias, key));
  if (byAlias) return byAlias.sponsorId;
  const canonical = name.trim().replace(/\s+/g, " ");
  await tx.insert(sponsors).values({ canonicalName: canonical, normalizedKey: key, firstSeenAt: seenAt }).onConflictDoNothing();
  const [created] = await tx.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.normalizedKey, key));
  return created?.id ?? null;
}

/** Remove everything extracted for an episode so it can be re-extracted cleanly. */
export async function clearExtraction(tx: Tx, episodeId: string): Promise<void> {
  await tx.execute(sql`delete from episode_guests where episode_id = ${episodeId}`);
  await tx.execute(sql`delete from episode_topics where episode_id = ${episodeId}`);
  await tx.execute(sql`delete from episode_sponsors where episode_id = ${episodeId}`);
}
