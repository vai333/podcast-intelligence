// Show lineup changes (spec section 9). Every change is one database transaction.
//  - a new show is tracked from NOW: no backfill, last_seen_published_at starts at now
//  - a removed show only gets active_to = now: nothing is ever deleted, past briefs never change
//  - re-adding a past show creates a NEW row with the same channel/show IDs (a new tracking period)
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { type ActionResult, ShowCandidate } from "@/lib/data/types";
import { db } from "@/lib/db/client";
import { shows } from "@/lib/db/schema";
import { logEvent } from "@/lib/pipeline/log";
import { getSettings } from "@/lib/pipeline/settings";
import * as yt from "@/lib/sources/youtube";

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

const Checked = ShowCandidate.extend({
  youtube: z
    .object({ channelId: z.string().regex(/^UC[\w-]{20,}$/), handle: z.string().max(100), subscribers: z.number().int().min(0) })
    .nullable(),
  spotify: z.object({ showId: z.string().regex(/^[A-Za-z0-9]{10,30}$/), publisher: z.string().max(200) }).nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
});

type ShowRow = typeof shows.$inferSelect;

/** Validates a candidate sent from the browser and fills in the real channel details from YouTube. */
async function prepare(raw: unknown): Promise<{ values: Omit<typeof shows.$inferInsert, "activeFrom" | "lastSeenPublishedAt"> } | { error: string }> {
  const parsed = Checked.safeParse(raw);
  if (!parsed.success) return { error: "That show's details look invalid. Search again and pick it from the results." };
  const c = parsed.data;
  if (!c.youtube && !c.spotify) return { error: "A show needs at least a YouTube channel or a Spotify show to be monitored." };

  let channel: yt.YtChannel | null = null;
  if (c.youtube) {
    try {
      channel = (await yt.getChannelsByIds([c.youtube.channelId]))[0] ?? null;
    } catch {
      return { error: "Could not reach YouTube to confirm that channel. Try again in a moment." };
    }
    if (!channel) return { error: "YouTube does not know that channel. Search again." };
  }
  return {
    values: {
      name: c.name,
      description: c.description,
      artworkUrl: c.artworkUrl,
      youtubeChannelId: channel?.id ?? null,
      youtubeUploadsPlaylistId: channel?.uploadsPlaylistId ?? null,
      youtubeHandle: channel?.handle ?? c.youtube?.handle ?? null,
      youtubeSubscribers: channel?.subscribers ?? c.youtube?.subscribers ?? null,
      spotifyShowId: c.spotify?.showId ?? null,
    },
  };
}

const lock = (tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }) => tx.execute(sql`select pg_advisory_xact_lock(7001)`);

function sameShow(a: Pick<ShowRow, "youtubeChannelId" | "spotifyShowId" | "name">, b: Pick<ShowRow, "youtubeChannelId" | "spotifyShowId" | "name">) {
  return (
    (!!a.youtubeChannelId && a.youtubeChannelId === b.youtubeChannelId) ||
    (!!a.spotifyShowId && a.spotifyShowId === b.spotifyShowId) ||
    a.name.toLowerCase() === b.name.toLowerCase()
  );
}

export async function addShow(raw: unknown): Promise<ActionResult> {
  const prep = await prepare(raw);
  if ("error" in prep) return fail(prep.error);
  const settings = await getSettings();
  const res = await db().transaction(async (tx) => {
    await lock(tx);
    const active = await tx.select().from(shows).where(isNull(shows.activeTo));
    if (active.length >= settings.maxActiveShows) return fail(`You are at the cap of ${settings.maxActiveShows} shows. Swap or remove one first.`);
    if (active.some((a) => sameShow(a, prep.values as ShowRow))) return fail(`${prep.values.name} is already in the lineup.`);
    const now = new Date();
    await tx.insert(shows).values({ ...prep.values, activeFrom: now, lastSeenPublishedAt: now });
    return ok(`Added ${prep.values.name}. Tracked from now, with no backfill.`);
  });
  if (res.ok) await logEvent("info", "show", "Show added to the lineup.", { label: prep.values.name });
  return res;
}

export async function swapShow(outGroupId: string, raw: unknown): Promise<ActionResult> {
  const prep = await prepare(raw);
  if ("error" in prep) return fail(prep.error);
  const res = await db().transaction(async (tx) => {
    await lock(tx);
    const [out] = await tx.select().from(shows).where(and(eq(shows.id, outGroupId), isNull(shows.activeTo)));
    if (!out) return fail("That show is not in the active lineup.");
    const active = await tx.select().from(shows).where(isNull(shows.activeTo));
    if (active.some((a) => a.id !== out.id && sameShow(a, prep.values as ShowRow))) return fail(`${prep.values.name} is already in the lineup.`);
    const now = new Date();
    await tx.update(shows).set({ activeTo: now }).where(eq(shows.id, out.id));
    await tx.insert(shows).values({ ...prep.values, activeFrom: now, lastSeenPublishedAt: now });
    return ok(`Swapped. ${prep.values.name} is tracked from now. New episodes appear after tonight's check.`);
  });
  if (res.ok) await logEvent("info", "show", `Swapped a show for ${prep.values.name}.`, { label: prep.values.name });
  return res;
}

export async function removeShow(groupId: string): Promise<ActionResult> {
  const res = await db().transaction(async (tx) => {
    await lock(tx);
    const [row] = await tx.select().from(shows).where(and(eq(shows.id, groupId), isNull(shows.activeTo)));
    if (!row) return fail("That show is not in the active lineup.");
    await tx.update(shows).set({ activeTo: new Date() }).where(eq(shows.id, row.id));
    return ok(`Removed ${row.name}. Its history is kept in Past shows.`);
  });
  if (res.ok) await logEvent("info", "show", "Show removed from the lineup.", { id: groupId });
  return res;
}

export async function readdShow(groupId: string): Promise<ActionResult> {
  const settings = await getSettings();
  const res = await db().transaction(async (tx) => {
    await lock(tx);
    const [old] = await tx.select().from(shows).where(eq(shows.id, groupId));
    if (!old) return fail("Show not found.");
    if (!old.activeTo) return fail("That show is already active.");
    const active = await tx.select().from(shows).where(isNull(shows.activeTo));
    if (active.length >= settings.maxActiveShows) return fail("You are at the cap. Remove another show first.");
    if (active.some((a) => sameShow(a, old))) return fail(`${old.name} is already in the lineup.`);
    const now = new Date();
    // A NEW row with the same channel and show IDs: the earlier period stays exactly as it was.
    await tx.insert(shows).values({
      name: old.name,
      description: old.description,
      artworkUrl: old.artworkUrl,
      youtubeChannelId: old.youtubeChannelId,
      youtubeUploadsPlaylistId: old.youtubeUploadsPlaylistId,
      youtubeHandle: old.youtubeHandle,
      youtubeSubscribers: old.youtubeSubscribers,
      spotifyShowId: old.spotifyShowId,
      activeFrom: now,
      lastSeenPublishedAt: now,
    });
    return ok(`${old.name} is back. A new tracking period starts now, with no backfill.`);
  });
  return res;
}
