// Integration tests against the real Neon database. Opt-in: `npm run test:db`.
// Each test cleans up everything it creates. Run only when no real worker job is pending.
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/lib/db/client";
import { jobs, settings, shows } from "@/lib/db/schema";
import { MAX_ATTEMPTS, claimNext, counts, defer, enqueue, fail, markDone, requeueStale } from "@/lib/pipeline/queue";
import { deleteSetting, getSettings, saveSettings } from "@/lib/pipeline/settings";
import { addShow, readdShow, removeShow, swapShow } from "@/lib/services/shows";

const RUN = !!process.env.RUN_DB_TESTS;
const tag = `it-${Date.now()}`;

describe.skipIf(!RUN)("job queue (real database)", () => {
  afterAll(async () => {
    await db().execute(sql`delete from jobs where payload->>'tag' = ${tag}`);
  });

  it("does not enqueue a duplicate of a pending job", async () => {
    const a = await enqueue("extract_episode", { episodeId: "00000000-0000-0000-0000-000000000000", tag });
    const b = await enqueue("extract_episode", { episodeId: "00000000-0000-0000-0000-000000000000", tag });
    expect(a).toBeTruthy();
    expect(b).toBeNull();
  });

  it("claims discovery before extraction and holds the weekly analysis until the rest is done", async () => {
    await db().execute(sql`delete from jobs where payload->>'tag' = ${tag}`);
    expect(await counts().then((c) => c.pending + c.running)).toBe(0); // the test needs an otherwise idle queue
    await enqueue("weekly_analysis", { weekStart: "1999-01-04", tag });
    await enqueue("extract_episode", { episodeId: "00000000-0000-0000-0000-000000000001", tag });
    await enqueue("discover_show", { showId: "00000000-0000-0000-0000-000000000002", tag });

    const first = await claimNext();
    expect(first?.type).toBe("discover_show");
    const second = await claimNext();
    expect(second?.type).toBe("extract_episode");
    // weekly stays blocked while the others are still running
    expect(await claimNext()).toBeNull();
    await markDone(first!.id);
    expect(await claimNext()).toBeNull();
    await markDone(second!.id);
    const third = await claimNext();
    expect(third?.type).toBe("weekly_analysis");
    await markDone(third!.id);
  });

  it("deferring does not count an attempt, and a job fails for good after the maximum attempts", async () => {
    await db().execute(sql`delete from jobs where payload->>'tag' = ${tag}`);
    await enqueue("extract_episode", { episodeId: "00000000-0000-0000-0000-000000000003", tag });
    let job = (await claimNext())!;
    expect(job.attempts).toBe(1);
    await defer(job, new Date(Date.now() - 1000), "rate limited");
    job = (await claimNext())!;
    expect(job.attempts).toBe(1); // the deferral did not use up an attempt

    expect(await fail(job, "boom")).toBe(false); // first failure: retry later
    await db().update(jobs).set({ runAfter: new Date() }).where(eq(jobs.id, job.id));
    job = (await claimNext())!;
    expect(job.attempts).toBe(2);
    expect(job.attempts).toBe(MAX_ATTEMPTS);
    expect(await fail(job, "boom again")).toBe(true);
    const [row] = await db().select().from(jobs).where(eq(jobs.id, job.id));
    expect(row.status).toBe("failed");
  });

  it("re-queues a job that has been running for more than 10 minutes", async () => {
    await db().execute(sql`delete from jobs where payload->>'tag' = ${tag}`);
    const [row] = await db()
      .insert(jobs)
      .values({ type: "refresh_views", payload: { tag }, status: "running", lockedAt: new Date(Date.now() - 11 * 60_000), attempts: 1 })
      .returning({ id: jobs.id });
    expect(await requeueStale()).toBeGreaterThanOrEqual(1);
    const [after] = await db().select().from(jobs).where(eq(jobs.id, row.id));
    expect(after.status).toBe("pending");
  });
});

// Two real, unrelated YouTube channels used only as swap fixtures (removed again at the end).
const CH_A = "UCYI330eZirRtyTzVgVf-mxQ";
const CH_B = "UCUXpaPHyLVgSdvWj9-BenRg";
const cand = (id: string, name: string) => ({
  id: `cand_${id}`,
  name,
  description: "test",
  artworkUrl: null,
  youtube: { channelId: id, handle: "@test", subscribers: 1 },
  spotify: null,
  matchNote: "test",
  matchConfidence: "high" as const,
});

describe.skipIf(!RUN)("lineup changes", () => {
  const cleanup = async () => {
    await db().delete(shows).where(inArray(shows.youtubeChannelId, [CH_A, CH_B]));
  };
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  /** Run with room for one more show, whatever the real lineup is, then put the settings back exactly. */
  const withRoomForOne = async (fn: () => Promise<void>) => {
    const saved = await db().select().from(settings);
    const active = (await db().select().from(shows).where(sql`${shows.activeTo} is null`)).length;
    const cur = await getSettings();
    try {
      await saveSettings({ ...cur, maxActiveShows: Math.max(cur.maxActiveShows, active + 1) });
      await fn();
    } finally {
      await db().delete(settings).where(inArray(settings.key, ["maxActiveShows", "minEpisodeMinutes", "maxEpisodeMinutes", "trendLookbackDays"]));
      if (saved.length) await db().insert(settings).values(saved).onConflictDoNothing();
    }
  };

  it("add, swap, remove and re-add follow the no-backfill, nothing-deleted rules", () => withRoomForOne(async () => {
    await cleanup();
    const [{ eps }] = (await db().execute(sql`select count(*)::int as eps from episodes`)).rows as { eps: number }[];
    const [{ brf }] = (await db().execute(sql`select count(*)::int as brf from briefs`)).rows as { brf: number }[];

    const added = await addShow(cand(CH_A, "Test Show A"));
    expect(added.ok).toBe(true);
    const [a] = await db().select().from(shows).where(eq(shows.youtubeChannelId, CH_A));
    // tracked from now, never backfilled
    expect(Math.abs(a.activeFrom.getTime() - Date.now())).toBeLessThan(30_000);
    expect(a.lastSeenPublishedAt!.getTime()).toBeGreaterThanOrEqual(a.activeFrom.getTime() - 1000);

    // a duplicate is refused
    expect((await addShow(cand(CH_A, "Test Show A"))).ok).toBe(false);

    // swap A for B in one transaction
    const swapped = await swapShow(a.id, cand(CH_B, "Test Show B"));
    expect(swapped.ok).toBe(true);
    const [a2] = await db().select().from(shows).where(eq(shows.id, a.id));
    const [b] = await db().select().from(shows).where(eq(shows.youtubeChannelId, CH_B));
    expect(a2.activeTo).not.toBeNull();
    expect(b.activeTo).toBeNull();
    expect(b.activeFrom.getTime()).toBeGreaterThanOrEqual(a2.activeTo!.getTime() - 5);

    // remove B, then re-add: a NEW row with the same IDs, the old one untouched
    expect((await removeShow(b.id)).ok).toBe(true);
    expect((await readdShow(b.id)).ok).toBe(true);
    const rowsForB = await db().select().from(shows).where(eq(shows.youtubeChannelId, CH_B));
    expect(rowsForB).toHaveLength(2);
    expect(rowsForB.filter((r) => r.activeTo === null)).toHaveLength(1);

    // nothing was deleted and no past brief changed
    const [{ eps: eps2 }] = (await db().execute(sql`select count(*)::int as eps2 from episodes`)).rows.map((r) => ({ eps: (r as { eps2: number }).eps2 }));
    const [{ brf: brf2 }] = (await db().execute(sql`select count(*)::int as brf2 from briefs`)).rows.map((r) => ({ brf: (r as { brf2: number }).brf2 }));
    expect(eps2).toBe(eps);
    expect(brf2).toBe(brf);
  }), 60_000);

  it("refuses to add a show beyond the cap, and lets the cap be raised again", async () => {
    await cleanup();
    const active = (await db().select().from(shows).where(sql`${shows.activeTo} is null`)).length;
    try {
      await saveSettings({ maxActiveShows: active, minEpisodeMinutes: 15, maxEpisodeMinutes: 120, trendLookbackDays: 30 });
      const r = await addShow(cand(CH_A, "Test Show A"));
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/cap of/);
      expect(await db().select().from(shows).where(eq(shows.youtubeChannelId, CH_A))).toHaveLength(0);
    } finally {
      await deleteSetting("maxActiveShows");
      await deleteSetting("minEpisodeMinutes");
      await deleteSetting("maxEpisodeMinutes");
      await deleteSetting("trendLookbackDays");
    }
    expect((await getSettings()).maxActiveShows).toBe(10);
  });
});
