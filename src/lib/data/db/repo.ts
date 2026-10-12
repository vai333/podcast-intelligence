// The real Repo, backed by Neon. Reads build a World from the database and reuse the shared derive/compose
// code; frozen briefs are read straight from the briefs table.
import { desc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { cronRuns, episodes, ingestionLog, jobs } from "@/lib/db/schema";
import { briefRecipients } from "@/lib/env";
import { kickWorker } from "@/lib/pipeline/kick";
import { logEvent } from "@/lib/pipeline/log";
import { counts, enqueue, retryFailed } from "@/lib/pipeline/queue";
import { getSettings, saveSettings } from "@/lib/pipeline/settings";
import { startRun } from "@/lib/pipeline/worker";
import { getBriefByWeek, getLatestBriefRow, listBriefItems, sendBrief } from "@/lib/services/briefs";
import { searchShowCandidates } from "@/lib/services/show-search";
import * as shows from "@/lib/services/shows";
import { YT_DAILY_QUOTA } from "@/lib/sources/youtube";
import { getUsage, istDay, weeklyTokens, youtubeDay } from "@/lib/usage";
import type { Repo } from "../repo";
import * as derive from "../derive";
import { type ActionResult, Settings, type SystemStatus } from "../types";
import { loadWorld } from "./world";

const world = cache(() => loadWorld());
const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const dbRepo: Repo = {
  async meta() {
    const w = await world();
    return { now: new Date().toISOString(), isSample: false, lastDataAt: new Date(w.lastDataAt || Date.now()).toISOString() };
  },

  getLatestBrief: getLatestBriefRow,
  getBrief: getBriefByWeek,
  listBriefs: listBriefItems,

  async listGuests(q) {
    return derive.listGuests(await world(), q);
  },
  async getGuest(id) {
    const [w, latest] = await Promise.all([world(), getLatestBriefRow()]);
    return derive.getGuest(w, id, latest);
  },
  async getTopicsOverview() {
    return derive.topicsOverview(await world());
  },
  async getTopic(id) {
    return derive.getTopic(await world(), id);
  },
  async listSponsors() {
    return derive.listSponsors(await world());
  },
  async getSponsor(id) {
    return derive.getSponsor(await world(), id);
  },
  async getLineup() {
    return derive.lineup(await world());
  },
  searchShows: (q) => searchShowCandidates(q),
  async listEpisodes(q) {
    return derive.listEpisodes(await world(), q);
  },

  async getSystemStatus(): Promise<SystemStatus> {
    const w = await world();
    const [q, latest, runs, ytUnits, gemEps, tokens] = await Promise.all([
      counts(),
      getLatestBriefRow(),
      db().select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(30),
      getUsage(youtubeDay(), "youtube_units"),
      getUsage(istDay(), "gemini_episodes"),
      weeklyTokens(),
    ]);
    const lastOf = (name: string) => runs.find((r) => r.name === name);
    const worker = lastOf("worker");
    const mailer = lastOf("mailer");
    const failedEps = w.episodes.filter((e) => e.status === "failed").length;
    const broken = w.shows.filter((s) => derive.isActive(s) && s.health === "error").length;
    const attention = q.failed > 0 || failedEps > 0 || broken > 0;
    const bits = [
      failedEps ? `${failedEps} episode${failedEps > 1 ? "s" : ""} failed` : "",
      q.failed ? `${q.failed} job${q.failed > 1 ? "s" : ""} failed` : "",
      broken ? `${broken} show${broken > 1 ? "s need" : " needs"} attention` : "",
    ].filter(Boolean);
    const sum = (r: typeof worker) => {
      const s = (r?.summary ?? {}) as Record<string, unknown>;
      if (!r) return "Has not run yet.";
      return r.name === "worker"
        ? `${s.discoverJobs ?? 0} discovery job(s) queued${s.jobsDone !== undefined ? ` · ${s.jobsDone} finished · ${s.jobsFailed ?? 0} failed` : ""}`
        : String(s.reason ?? (s.sent ? "Brief sent" : "Nothing sent"));
    };
    return {
      verdict: attention ? "attention" : "ok",
      verdictText: attention ? `${bits.join(" and ")}. Review the log below.` : "All good. Nothing needs attention.",
      worker: { state: w.workerRunning ? "running" : "idle", lastRunAt: iso(worker?.finishedAt ?? worker?.startedAt ?? null) },
      queue: q,
      cron: [
        { name: "Nightly worker", schedule: "Daily, 00:30 IST", lastRunAt: iso(worker?.startedAt ?? null), outcome: worker?.outcome ?? null, summary: sum(worker) },
        { name: "Monday mailer", schedule: "Mondays, about 7:00 AM IST", lastRunAt: iso(mailer?.startedAt ?? null), outcome: mailer?.outcome ?? null, summary: sum(mailer) },
      ],
      quota: {
        youtubeUnitsUsed: ytUnits,
        youtubeUnitsLimit: YT_DAILY_QUOTA,
        geminiEpisodesToday: gemEps,
        geminiEpisodesLimit: Number(process.env.GEMINI_DAILY_EPISODE_LIMIT ?? 40),
        weeklyTokens: tokens,
      },
      recipients: briefRecipients(),
      latestBriefWeek: latest?.weekStart ?? null,
      latestBriefSent: !!latest?.sentAt,
    };
  },

  async getLogs(opts) {
    const rows = await db()
      .select()
      .from(ingestionLog)
      .where(opts?.level ? eq(ingestionLog.level, opts.level) : undefined)
      .orderBy(desc(ingestionLog.createdAt))
      .limit(200);
    return rows.map((l) => ({ id: l.id, at: l.createdAt.toISOString(), level: l.level, scope: l.scope, message: l.message, refLabel: l.refLabel }));
  },

  getSettings,

  mutations: {
    swapShow: (outId, candidate) => shows.swapShow(outId, candidate),
    addShow: (candidate) => shows.addShow(candidate),
    removeShow: (id) => shows.removeShow(id),
    readdShow: (id) => shows.readdShow(id),

    async runWorkerNow() {
      const running = await db().select({ id: jobs.id }).from(jobs).where(eq(jobs.status, "running")).limit(1);
      if (running.length) return fail("The worker is already running.");
      const s = await startRun("manual");
      kickWorker();
      return ok(`Worker started: ${s.discoverJobs} show check(s) queued. Watch the queue and log for progress.`);
    },

    async sendBriefNow({ resend }) {
      const latest = await getLatestBriefRow();
      if (!latest) return fail("There is no brief to send yet.");
      return sendBrief(latest.weekStart, { resend });
    },

    async rerunExtraction(episodeId) {
      const [e] = await db().select({ id: episodes.id, title: episodes.title }).from(episodes).where(eq(episodes.id, episodeId));
      if (!e) return fail("Episode not found.");
      await db().update(episodes).set({ status: "discovered", statusNote: null }).where(eq(episodes.id, episodeId));
      await enqueue("extract_episode", { episodeId, force: true });
      kickWorker();
      return ok(`Queued a fresh extraction for "${e.title}".`);
    },

    async retryFailedJobs() {
      const n = await retryFailed();
      if (n) kickWorker();
      return ok(n ? `${n} failed job${n > 1 ? "s" : ""} re-queued.` : "No failed jobs to retry.");
    },

    async saveSettings(input) {
      const parsed = Settings.safeParse(input);
      if (!parsed.success) return fail("Some values are out of range. Check the highlighted fields.");
      const s = parsed.data;
      if (s.minEpisodeMinutes >= s.maxEpisodeMinutes) return fail("The minimum length must be shorter than the maximum.");
      const w = await world();
      const active = w.shows.filter(derive.isActive).length;
      if (s.maxActiveShows < active) return fail(`You have ${active} active shows. Remove some before lowering the cap to ${s.maxActiveShows}.`);
      await saveSettings(s);
      await logEvent("info", "queue", "Settings updated.");
      return ok("Settings saved.");
    },
  },
};

