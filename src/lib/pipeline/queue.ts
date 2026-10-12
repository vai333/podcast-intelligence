// Postgres-backed job queue (spec 4.2). No external queue service.
//  - claim one job at a time with FOR UPDATE SKIP LOCKED
//  - a job stuck in 'running' for more than 10 minutes is considered abandoned and re-queued
//  - max 2 attempts, then the job is marked failed and we move on
//  - the weekly analysis only runs once every other job that is ready has finished
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";

export type JobType = "discover_show" | "extract_episode" | "refresh_views" | "weekly_analysis";
export type Job = typeof jobs.$inferSelect;

export const MAX_ATTEMPTS = 2;
const STALE_MS = 10 * 60_000;
const RETRY_DELAY_MS = 10 * 60_000;

/** Thrown by a handler to put the job back without counting an attempt (rate limit, daily cap). */
export class DeferJob extends Error {
  constructor(
    message: string,
    public readonly until: Date,
    /** Also push back every other pending job of the same type (a daily quota applies to all of them). */
    public readonly all = false,
  ) {
    super(message);
    this.name = "DeferJob";
  }
}

/** Enqueue unless an identical job is already pending or running. Returns the new id, or null if deduped. */
export async function enqueue(type: JobType, payload: Record<string, unknown>, runAfter?: Date): Promise<string | null> {
  const json = JSON.stringify(payload);
  const existing = await db().execute(
    sql`select 1 from jobs where type = ${type} and status in ('pending','running') and payload = ${json}::jsonb limit 1`,
  );
  if (existing.rows.length) return null;
  const [row] = await db()
    .insert(jobs)
    .values({ type, payload, runAfter: runAfter ?? new Date() })
    .returning({ id: jobs.id });
  return row.id;
}

/** Re-queue jobs whose worker died mid-run. */
export async function requeueStale(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const res = await db()
    .update(jobs)
    .set({ status: "pending", lockedAt: null, lastError: "Abandoned while running; re-queued" })
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, cutoff)))
    .returning({ id: jobs.id });
  return res.length;
}

/**
 * Claim the next ready job. Ordering: discovery, then view refresh, then extraction, then the weekly
 * analysis (which is skipped while any other ready or running job exists).
 */
export async function claimNext(): Promise<Job | null> {
  const res = await db().execute(sql`
    update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
    where id = (
      select j.id from jobs j
      where j.status = 'pending' and j.run_after <= now()
        and (
          j.type <> 'weekly_analysis'
          or not exists (
            select 1 from jobs o
            where o.id <> j.id and o.type <> 'weekly_analysis'
              and (o.status = 'running' or (o.status = 'pending' and o.run_after <= now()))
          )
        )
      order by case j.type when 'discover_show' then 0 when 'refresh_views' then 1 when 'extract_episode' then 2 else 3 end, j.created_at
      for update skip locked
      limit 1
    )
    returning *`);
  const r = res.rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: r.id as string,
    type: r.type as JobType,
    payload: r.payload,
    status: r.status as Job["status"],
    attempts: r.attempts as number,
    lastError: (r.last_error as string | null) ?? null,
    lockedAt: r.locked_at ? new Date(r.locked_at as string) : null,
    runAfter: new Date(r.run_after as string),
    createdAt: new Date(r.created_at as string),
    finishedAt: r.finished_at ? new Date(r.finished_at as string) : null,
  };
}

export async function markDone(id: string): Promise<void> {
  await db().update(jobs).set({ status: "done", finishedAt: new Date(), lockedAt: null, lastError: null }).where(eq(jobs.id, id));
}

export async function markSkipped(id: string, reason: string): Promise<void> {
  await db().update(jobs).set({ status: "skipped", finishedAt: new Date(), lockedAt: null, lastError: reason.slice(0, 500) }).where(eq(jobs.id, id));
}

/** Put the job back without counting this attempt. */
export async function defer(job: Job, until: Date, reason: string): Promise<void> {
  await db()
    .update(jobs)
    .set({ status: "pending", lockedAt: null, runAfter: until, attempts: Math.max(0, job.attempts - 1), lastError: reason.slice(0, 500) })
    .where(eq(jobs.id, job.id));
}

/** Record a failure: retry later, or give up after MAX_ATTEMPTS. Returns true when the job is finished for good. */
/** Push every pending job of a type back to `until`, so they do not each hit the same exhausted quota. */
export async function deferAllPending(type: JobType, until: Date): Promise<number> {
  const rows = await db()
    .update(jobs)
    .set({ runAfter: until })
    .where(and(eq(jobs.type, type), eq(jobs.status, "pending")))
    .returning({ id: jobs.id });
  return rows.length;
}

export async function fail(job: Job, error: string): Promise<boolean> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await db().update(jobs).set({ status: "failed", finishedAt: new Date(), lockedAt: null, lastError: error.slice(0, 500) }).where(eq(jobs.id, job.id));
    return true;
  }
  await db()
    .update(jobs)
    .set({ status: "pending", lockedAt: null, runAfter: new Date(Date.now() + RETRY_DELAY_MS), lastError: error.slice(0, 500) })
    .where(eq(jobs.id, job.id));
  return false;
}

export async function counts(): Promise<{ pending: number; running: number; failed: number; done: number; skipped: number }> {
  const res = await db().execute(sql`select status, count(*)::int as n from jobs group by status`);
  const out = { pending: 0, running: 0, failed: 0, done: 0, skipped: 0 };
  for (const r of res.rows as { status: keyof typeof out; n: number }[]) out[r.status] = r.n;
  return out;
}

/** True if another job is ready to run right now (used to decide whether to chain). */
export async function hasReadyJob(): Promise<boolean> {
  const res = await db().execute(sql`select 1 from jobs where status = 'pending' and run_after <= now() limit 1`);
  return res.rows.length > 0;
}

/** Retry every failed job once more (the System page's "Retry failed" button). */
export async function retryFailed(): Promise<number> {
  const res = await db()
    .update(jobs)
    .set({ status: "pending", attempts: 0, runAfter: new Date(), finishedAt: null, lastError: null })
    .where(eq(jobs.status, "failed"))
    .returning({ id: jobs.id });
  return res.length;
}
