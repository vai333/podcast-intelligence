// Weekly consolidation (spec 8.3). Gemini decides which new guest/topic/sponsor records are duplicates of
// existing ones, in small batches. We only merge when it is confident and the ids are ones we sent.
// Every call is best-effort: failure is logged and the run continues.
import { eq, gt, inArray, sql } from "drizzle-orm";
import { generateJson } from "@/lib/ai/gemini";
import { GUEST_MERGE_INSTRUCTIONS, SPONSOR_MERGE_INSTRUCTIONS, TOPIC_MAPPING_INSTRUCTIONS } from "@/lib/ai/prompts";
import { MergeGroups, TopicMapping, mergeResponseSchema, topicMappingResponseSchema } from "@/lib/ai/schemas";
import { normalizeGuestKey, normalizeSponsorKey } from "@/lib/ai/normalize";
import { db } from "@/lib/db/client";
import {
  episodeGuests,
  episodeSponsors,
  episodes,
  guestAliases,
  guests,
  shows,
  sponsorAliases,
  sponsors,
  topicAliases,
  topics,
} from "@/lib/db/schema";
import { errMsg, logEvent } from "./log";

const NEW_WINDOW_MS = 8 * 86_400_000;
const MAX_RECORDS = 60;

export interface ConsolidationResult {
  guestsMerged: number;
  topicsMerged: number;
  sponsorsMerged: number;
}

export async function consolidate(): Promise<ConsolidationResult> {
  const out: ConsolidationResult = { guestsMerged: 0, topicsMerged: 0, sponsorsMerged: 0 };
  const since = new Date(Date.now() - NEW_WINDOW_MS);
  for (const [name, fn, key] of [
    ["guests", () => consolidateGuests(since), "guestsMerged"],
    ["topics", () => consolidateTopics(since), "topicsMerged"],
    ["sponsors", () => consolidateSponsors(since), "sponsorsMerged"],
  ] as const) {
    try {
      out[key] = await fn();
    } catch (e) {
      await logEvent("warn", "api", `Consolidation of ${name} skipped: ${errMsg(e)}`);
    }
  }
  return out;
}

/* ------------------------------ guests ------------------------------ */

async function consolidateGuests(since: Date): Promise<number> {
  const fresh = await db().select().from(guests).where(gt(guests.createdAt, since));
  if (!fresh.length) return 0;
  const all = await db().select().from(guests);
  const freshIds = new Set(fresh.map((g) => g.id));
  const last = (k: string) => k.split(" ").slice(-1)[0];
  const candidates = new Map<string, (typeof all)[number]>();
  for (const f of fresh) {
    candidates.set(f.id, f);
    for (const o of all) {
      if (o.id === f.id) continue;
      const sameLast = last(o.normalizedKey) === last(f.normalizedKey);
      const sameCompany = !!o.titleOrCompany && o.titleOrCompany === f.titleOrCompany;
      if (sameLast || sameCompany) candidates.set(o.id, o);
    }
  }
  if (candidates.size < 2) return 0;
  const picked = [...candidates.values()].slice(0, MAX_RECORDS);

  const showsOf = await db()
    .select({ guestId: episodeGuests.guestId, show: shows.name })
    .from(episodeGuests)
    .innerJoin(episodes, eq(episodes.id, episodeGuests.episodeId))
    .innerJoin(shows, eq(shows.id, episodes.showId))
    .where(inArray(episodeGuests.guestId, picked.map((p) => p.id)));
  const showMap = new Map<string, Set<string>>();
  for (const r of showsOf) showMap.set(r.guestId, (showMap.get(r.guestId) ?? new Set()).add(r.show));

  const records = picked.map((g) => ({ id: g.id, name: g.canonicalName, company: g.titleOrCompany, shows: [...(showMap.get(g.id) ?? [])] }));
  const res = await generateJson({
    parts: [{ text: `${GUEST_MERGE_INSTRUCTIONS}\n\nRECORDS:\n${JSON.stringify(records)}` }],
    responseSchema: mergeResponseSchema,
    schema: MergeGroups,
  });
  return applyMerges(res.data, new Set(picked.map((p) => p.id)), freshIds, async (keep, gone) => {
    const [k] = picked.filter((p) => p.id === keep);
    const [g] = picked.filter((p) => p.id === gone);
    await db().transaction(async (tx) => {
      for (const alias of new Set([normalizeGuestKey(g.canonicalName), ...[]])) {
        if (alias && alias !== k.normalizedKey) await tx.insert(guestAliases).values({ guestId: keep, alias }).onConflictDoNothing();
      }
      await tx.execute(sql`update guest_aliases set guest_id = ${keep} where guest_id = ${gone} and alias not in (select alias from guest_aliases where guest_id = ${keep})`);
      await tx.execute(sql`insert into episode_guests (episode_id, guest_id, role) select episode_id, ${keep}::uuid, role from episode_guests where guest_id = ${gone} on conflict do nothing`);
      if (!k.titleOrCompany && g.titleOrCompany) await tx.update(guests).set({ titleOrCompany: g.titleOrCompany }).where(eq(guests.id, keep));
      await tx.delete(guests).where(eq(guests.id, gone));
    });
  });
}

/* ------------------------------ sponsors ------------------------------ */

async function consolidateSponsors(since: Date): Promise<number> {
  const fresh = await db().select().from(sponsors).where(gt(sponsors.createdAt, since));
  if (!fresh.length) return 0;
  const all = await db().select().from(sponsors);
  if (all.length < 2) return 0;
  const picked = [...fresh, ...all.filter((s) => !fresh.some((f) => f.id === s.id))].slice(0, MAX_RECORDS);
  const res = await generateJson({
    parts: [{ text: `${SPONSOR_MERGE_INSTRUCTIONS}\n\nRECORDS:\n${JSON.stringify(picked.map((s) => ({ id: s.id, name: s.canonicalName })))}` }],
    responseSchema: mergeResponseSchema,
    schema: MergeGroups,
  });
  return applyMerges(res.data, new Set(picked.map((p) => p.id)), new Set(fresh.map((f) => f.id)), async (keep, gone) => {
    const g = picked.find((p) => p.id === gone)!;
    const k = picked.find((p) => p.id === keep)!;
    await db().transaction(async (tx) => {
      const alias = normalizeSponsorKey(g.canonicalName);
      if (alias && alias !== k.normalizedKey) await tx.insert(sponsorAliases).values({ sponsorId: keep, alias }).onConflictDoNothing();
      await tx.execute(sql`update sponsor_aliases set sponsor_id = ${keep} where sponsor_id = ${gone} and alias not in (select alias from sponsor_aliases where sponsor_id = ${keep})`);
      await tx.update(episodeSponsors).set({ sponsorId: keep }).where(eq(episodeSponsors.sponsorId, gone));
      if (g.firstSeenAt < k.firstSeenAt) await tx.update(sponsors).set({ firstSeenAt: g.firstSeenAt }).where(eq(sponsors.id, keep));
      await tx.delete(sponsors).where(eq(sponsors.id, gone));
    });
  });
}

/* ------------------------------ topics ------------------------------ */

async function consolidateTopics(since: Date): Promise<number> {
  const fresh = await db().select().from(topics).where(gt(topics.createdAt, since));
  if (!fresh.length) return 0;
  const existing = (await db().select().from(topics).where(sql`${topics.createdAt} <= ${since}`)).slice(0, MAX_RECORDS);
  if (!existing.length) return 0;
  const res = await generateJson({
    parts: [
      {
        text: `${TOPIC_MAPPING_INSTRUCTIONS}\n\nNEW:\n${JSON.stringify(fresh.slice(0, MAX_RECORDS).map((t) => ({ id: t.id, label: t.canonicalLabel })))}\n\nEXISTING:\n${JSON.stringify(existing.map((t) => ({ id: t.id, label: t.canonicalLabel })))}`,
      },
    ],
    responseSchema: topicMappingResponseSchema,
    schema: TopicMapping,
  });
  const freshIds = new Set(fresh.map((f) => f.id));
  const existingIds = new Set(existing.map((e) => e.id));
  let merged = 0;
  for (const m of res.data.mappings) {
    if (!m.maps_to || !freshIds.has(m.id) || !existingIds.has(m.maps_to) || m.id === m.maps_to) continue;
    const gone = fresh.find((f) => f.id === m.id)!;
    await db().transaction(async (tx) => {
      await tx.insert(topicAliases).values({ topicId: m.maps_to!, alias: gone.canonicalLabel }).onConflictDoNothing();
      await tx.execute(sql`insert into episode_topics (episode_id, topic_id, weight) select episode_id, ${m.maps_to}::uuid, weight from episode_topics where topic_id = ${gone.id} on conflict do nothing`);
      await tx.delete(topics).where(eq(topics.id, gone.id));
    });
    merged++;
  }
  return merged;
}

/** Apply only confident groups whose ids we actually sent, merging new records into one that is kept. */
async function applyMerges(
  groups: MergeGroups,
  sent: Set<string>,
  fresh: Set<string>,
  merge: (keep: string, gone: string) => Promise<void>,
): Promise<number> {
  let n = 0;
  const removed = new Set<string>();
  for (const g of groups.groups) {
    if (!g.confident || !sent.has(g.keep) || removed.has(g.keep)) continue;
    for (const gone of g.merge) {
      if (gone === g.keep || !sent.has(gone) || removed.has(gone)) continue;
      // never delete an old record in favour of a brand-new one: keep the older id
      const [keep, drop] = fresh.has(g.keep) && !fresh.has(gone) ? [gone, g.keep] : [g.keep, gone];
      await merge(keep, drop);
      removed.add(drop);
      n++;
    }
  }
  return n;
}

