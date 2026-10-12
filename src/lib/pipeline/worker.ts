// Worker orchestration (spec 4). One job per invocation; the route handler chains itself so each
// invocation stays short and resumable. Nothing here throws out to a cron handler.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { briefs, cronRuns, shows } from "@/lib/db/schema";
import * as yt from "@/lib/sources/youtube";
import { istWeekday, startOfDayIST, addDaysISO } from "@/lib/time";
import { discoverShow } from "./discover";
import { extractEpisode, markEpisodeFailed } from "./extract";
import { errMsg, logEvent } from "./log";
import { DeferJob, claimNext, defer, deferAllPending, enqueue, fail, hasReadyJob, markDone, markSkipped, requeueStale, type Job } from "./queue";
import { refreshViews } from "./views";
import { previousWeekStart, runWeeklyAnalysis } from "./weekly";

export interface StartSummary {
  requeued: number;
  discoverJobs: number;
  weeklyQueued: boolean;
}

/** Called by the nightly cron (and the "Run worker now" button): queue the night's work. */
export async function startRun(trigger: "cron" | "manual"): Promise<StartSummary> {
  const requeued = await requeueStale();
  const active = await db().select({ id: shows.id, name: shows.name }).from(shows).where(isNull(shows.activeTo));
  let discoverJobs = 0;
  for (const s of active) if (await enqueue("discover_show", { showId: s.id })) discoverJobs++;

  // Monday (IST): produce the brief for the week that just ended. Also catches up if a Monday run was missed.
  const weekStart = previousWeekStart();
  const [have] = await db().select({ id: briefs.id }).from(briefs).where(eq(briefs.weekStart, weekStart));
  let weeklyQueued = false;
  if (!have) {
    const start = startOfDayIST(weekStart);
    const end = startOfDayIST(addDaysISO(weekStart, 7));
    const [{ n }] = (await db().execute(
      sql`select count(*)::int as n from episodes where status = 'extracted' and published_at >= ${start} and published_at < ${end}`,
    )).rows as { n: number }[];
    if (istWeekday() === 1 || n > 0) weeklyQueued = !!(await enqueue("weekly_analysis", { weekStart }));
  }

  await db().insert(cronRuns).values({ name: "worker", summary: { trigger, requeued, discoverJobs, weeklyQueued } });
  await logEvent("info", "queue", `Worker run started (${trigger}): ${discoverJobs} discovery job(s)${weeklyQueued ? ", weekly analysis queued" : ""}.`);
  return { requeued, discoverJobs, weeklyQueued };
}

export interface StepResult {
  idle: boolean;
  more: boolean;
  job?: { id: string; type: Job["type"] };
  outcome?: "done" | "skipped" | "deferred" | "retry" | "failed";
  error?: string;
}

async function run(job: Job): Promise<"done" | "skipped"> {
  const p = job.payload as Record<string, string>;
  switch (job.type) {
    case "discover_show":
      await discoverShow(p.showId);
      return "done";
    case "extract_episode":
      return (await extractEpisode(p.episodeId, { force: (job.payload as { force?: boolean }).force === true })) === "skipped" ? "skipped" : "done";
    case "refresh_views":
      await refreshViews();
      return "done";
    case "weekly_analysis": {
      const r = await runWeeklyAnalysis(p.weekStart);
      return r.created ? "done" : "skipped";
    }
  }
}

/** Claim and run exactly one job. */
export async function processOne(): Promise<StepResult> {
  const job = await claimNext();
  if (!job) return { idle: true, more: false };
  const ref = { id: job.id, type: job.type };
  try {
    const outcome = await run(job);
    if (outcome === "skipped") await markSkipped(job.id, "Nothing to do");
    else await markDone(job.id);
    return { idle: false, more: await hasReadyJob(), job: ref, outcome };
  } catch (e) {
    if (e instanceof DeferJob) {
      await defer(job, e.until, e.message);
      const others = e.all ? await deferAllPending(job.type, e.until) : 0;
      await logEvent("info", "queue", `Deferred ${job.type}${others ? ` (and ${others} more)` : ""} until ${e.until.toISOString().slice(0, 16)}Z: ${e.message}`);
      return { idle: false, more: await hasReadyJob(), job: ref, outcome: "deferred" };
    }
    if (e instanceof yt.QuotaError) {
      await defer(job, new Date(Date.now() + 6 * 3_600_000), e.message);
      await logEvent("warn", "api", `YouTube quota nearly used up; ${job.type} deferred 6h.`);
      return { idle: false, more: await hasReadyJob(), job: ref, outcome: "deferred" };
    }
    const msg = errMsg(e);
    const finished = await fail(job, msg);
    await logEvent("error", "queue", `${job.type} ${finished ? "failed" : "will retry"}: ${msg}`, { id: job.id });
    if (finished && job.type === "extract_episode") await markEpisodeFailed((job.payload as { episodeId: string }).episodeId, msg);
    return { idle: false, more: await hasReadyJob(), job: ref, outcome: finished ? "failed" : "retry", error: msg };
  }
}

/** Close the latest unfinished worker run, marking it partial if any job failed since it started. */
export async function finishRun(): Promise<void> {
  const [run] = await db().select().from(cronRuns).where(and(eq(cronRuns.name, "worker"), isNull(cronRuns.finishedAt))).orderBy(desc(cronRuns.startedAt)).limit(1);
  if (!run) return;
  const [{ n }] = (await db().execute(
    sql`select count(*)::int as n from jobs where status = 'failed' and finished_at >= ${run.startedAt}`,
  )).rows as { n: number }[];
  const [{ done }] = (await db().execute(
    sql`select count(*)::int as done from jobs where status in ('done','skipped') and finished_at >= ${run.startedAt}`,
  )).rows as { done: number }[];
  await db()
    .update(cronRuns)
    .set({ finishedAt: new Date(), outcome: n > 0 ? "partial" : "ok", summary: { ...(run.summary as object), jobsDone: done, jobsFailed: n } })
    .where(eq(cronRuns.id, run.id));
}

/** Drain the queue in-process (scripts and local development). */
export async function drain(opts: { maxJobs?: number; onStep?: (s: StepResult) => void } = {}): Promise<number> {
  let n = 0;
  for (; n < (opts.maxJobs ?? 500); n++) {
    const s = await processOne();
    opts.onStep?.(s);
    if (s.idle) break;
  }
  await finishRun();
  return n;
}

