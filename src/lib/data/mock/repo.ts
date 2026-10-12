// Mock implementation of Repo. Replace with src/lib/data/db/ (Drizzle + Neon) later: same interface.
import { cookies } from "next/headers";
import type { Repo } from "../repo";
import * as derive from "../derive";
import {
  type ActionResult,
  type Brief,
  type MockScenario,
  type ShowCandidate,
  Settings,
} from "../types";
import { briefHeadline, composeBrief } from "./briefs";
import { slug } from "./rng";
import { type WShow, type World, generateWorld } from "./world";

const SCENARIOS: MockScenario[] = ["full", "first-week", "empty"];

interface Store {
  world: World;
  briefs: Map<string, Brief>;
}
type Globals = { __podcastMock?: Partial<Record<MockScenario, Store>> };
const g = globalThis as unknown as Globals;

export async function currentScenario(): Promise<MockScenario> {
  const c = (await cookies()).get("mock_scenario")?.value as MockScenario | undefined;
  return c && SCENARIOS.includes(c) ? c : "full";
}

function storeFor(scenario: MockScenario): Store {
  g.__podcastMock ??= {};
  let s = g.__podcastMock[scenario];
  if (!s) {
    const world = generateWorld(scenario);
    const briefs = new Map<string, Brief>();
    // Briefs are frozen at creation: later swaps never change them (spec section 9).
    for (const w of world.briefWeeks) briefs.set(w, composeBrief(world, w));
    s = { world, briefs };
    g.__podcastMock[scenario] = s;
  }
  return s;
}

async function store(): Promise<Store> {
  return storeFor(await currentScenario());
}

export function resetMock() {
  g.__podcastMock = {};
}

const { iso, isActive } = derive;
const tick = (w: World) => {
  w.now += 3 * 60_000;
  w.lastDataAt = w.now;
  return w.now;
};

const CATALOG: ShowCandidate[] = [
  {
    id: "cand_capitalchai",
    name: "Capital Chai",
    description: "Weekly deal talk over chai: what founders and funds are doing right now.",
    artworkUrl: null,
    youtube: { channelId: "UCcapchai01", handle: "@capitalchai", subscribers: 152_000 },
    spotify: { showId: "sp_capitalchai", publisher: "Capital Chai Media" },
    matchNote: "Names match closely on both platforms.",
    matchConfidence: "high",
  },
  {
    id: "cand_unicorndiaries",
    name: "Unicorn Diaries",
    description: "Late-stage operators on the messy middle of scaling to a billion.",
    artworkUrl: null,
    youtube: { channelId: "UCunicorn02", handle: "@unicorndiaries", subscribers: 89_000 },
    spotify: { showId: "sp_unicorndiaries", publisher: "Unicorn Diaries Pvt Ltd" },
    matchNote: "Check this pair: the Spotify publisher name differs from the YouTube channel.",
    matchConfidence: "check",
  },
  {
    id: "cand_bharatbuilders",
    name: "Bharat Builders",
    description: "Founders building for the next 500 million internet users.",
    artworkUrl: null,
    youtube: null,
    spotify: { showId: "sp_bharatbuilders", publisher: "Bharat Builders" },
    matchNote: "Only found on Spotify. No YouTube channel matched.",
    matchConfidence: "high",
  },
  {
    id: "cand_capTable",
    name: "The Cap Table",
    description: "Equity, ESOPs and term sheets explained by people who negotiate them.",
    artworkUrl: null,
    youtube: { channelId: "UCcaptable03", handle: "@thecaptable", subscribers: 47_000 },
    spotify: { showId: "sp_captable", publisher: "The Cap Table" },
    matchNote: "Names match closely on both platforms.",
    matchConfidence: "high",
  },
  {
    id: "cand_scalingsaathi",
    name: "Scaling Saathi",
    description: "Operator playbooks for the first hundred crore.",
    artworkUrl: null,
    youtube: { channelId: "UCsaathi04", handle: "@scalingsaathi", subscribers: 33_000 },
    spotify: null,
    matchNote: "Only found on YouTube.",
    matchConfidence: "high",
  },
  {
    id: "cand_fundingfriday",
    name: "Funding Friday",
    description: "Every Friday: the week's rounds, decoded.",
    artworkUrl: null,
    youtube: { channelId: "UCfunding05", handle: "@fundingfriday", subscribers: 61_000 },
    spotify: { showId: "sp_fundingfriday", publisher: "Funding Friday" },
    matchNote: "Names match closely on both platforms.",
    matchConfidence: "high",
  },
];

function candidateToShow(c: ShowCandidate, now: number): WShow {
  return {
    id: `show_${slug(c.name)}`,
    name: c.name,
    description: c.description,
    handle: c.youtube?.handle ?? "",
    subscribers: c.youtube?.subscribers ?? 0,
    hasYoutube: !!c.youtube,
    hasSpotify: !!c.spotify,
    health: "ok",
    healthNote: null,
    intervals: [{ from: now, to: null }],
    channelId: c.youtube?.channelId ?? null,
    spotifyId: c.spotify?.showId ?? null,
  };
}

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

export const mockRepo: Repo = {
  async meta() {
    const { world } = await store();
    return { now: iso(world.now), isSample: true, lastDataAt: iso(world.lastDataAt) };
  },

  async getLatestBrief() {
    const { world, briefs } = await store();
    const w = world.briefWeeks[world.briefWeeks.length - 1];
    return w ? (briefs.get(w) ?? null) : null;
  },
  async getBrief(weekStart) {
    return (await store()).briefs.get(weekStart) ?? null;
  },
  async listBriefs() {
    const { world, briefs } = await store();
    return [...world.briefWeeks]
      .reverse()
      .map((w) => briefs.get(w)!)
      .map((b) => ({
        weekStart: b.weekStart,
        weekEnd: b.weekEnd,
        generatedAt: b.generatedAt,
        sentAt: b.sentAt,
        coverage: b.coverage,
        guestsCount: b.guests.length,
        topicsCount: b.topics.length,
        sponsorsCount: b.sponsors.length,
        headline: briefHeadline(b),
      }));
  },

  async listGuests(q) {
    return derive.listGuests((await store()).world, q);
  },
  async getGuest(id) {
    const { world, briefs } = await store();
    return derive.getGuest(world, id, [...briefs.values()].pop() ?? null);
  },
  async getTopicsOverview() {
    return derive.topicsOverview((await store()).world);
  },
  async getTopic(id) {
    return derive.getTopic((await store()).world, id);
  },
  async listSponsors() {
    return derive.listSponsors((await store()).world);
  },
  async getSponsor(id) {
    return derive.getSponsor((await store()).world, id);
  },
  async getLineup() {
    return derive.lineup((await store()).world);
  },

  async searchShows(q) {
    const { world } = await store();
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    if (/youtube\.com|youtu\.be|spotify\.com/.test(needle)) {
      const isYt = /youtu/.test(needle);
      const handle = (needle.match(/@([a-z0-9_.-]+)/)?.[1] ?? needle.split("/").filter(Boolean).pop() ?? "pasted").replace(/[^a-z0-9_.-]/g, "");
      const name = handle.replace(/[-_.]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      return [
        {
          id: `cand_${slug(handle)}`,
          name,
          description: "Found from the link you pasted.",
          artworkUrl: null,
          youtube: isYt ? { channelId: `UC${slug(handle).slice(0, 8)}`, handle: `@${handle}`, subscribers: 28_000 } : null,
          spotify: isYt ? null : { showId: `sp_${slug(handle)}`, publisher: name },
          matchNote: isYt ? "Only the YouTube channel was pasted. Add a Spotify show if there is one." : "Only the Spotify show was pasted. Add a YouTube channel if there is one.",
          matchConfidence: "check" as const,
        },
      ];
    }
    const have = new Set(world.shows.filter(isActive).map((s) => s.name.toLowerCase()));
    return CATALOG.filter((c) => `${c.name} ${c.description}`.toLowerCase().includes(needle) && !have.has(c.name.toLowerCase()));
  },

  async listEpisodes(q) {
    return derive.listEpisodes((await store()).world, q);
  },

  async getSystemStatus() {
    const { world, briefs } = await store();
    const failed = world.episodes.filter((e) => e.status === "failed").length;
    const skipped = world.episodes.filter((e) => e.status === "skipped").length;
    const broken = world.shows.filter((s) => isActive(s) && s.health === "error").length;
    const attention = failed > 0 || broken > 0;
    const latest = world.briefWeeks[world.briefWeeks.length - 1] ?? null;
    const done = world.episodes.filter((e) => e.status === "extracted").length;
    return {
      verdict: attention ? ("attention" as const) : ("ok" as const),
      verdictText: attention
        ? `${failed ? `${failed} episode${failed > 1 ? "s" : ""} failed` : ""}${failed && broken ? " and " : ""}${broken ? `${broken} show${broken > 1 ? "s" : ""} unreachable` : ""}. Review the log below.`
        : "All good. The last worker run finished cleanly.",
      worker: { state: world.workerRunning ? ("running" as const) : ("idle" as const), lastRunAt: iso(world.lastWorkerAt) },
      queue: { pending: 0, running: world.workerRunning ? 1 : 0, failed, done, skipped },
      cron: [
        { name: "Nightly worker", schedule: "Daily, 00:30 IST", lastRunAt: iso(world.lastWorkerAt), outcome: attention ? ("partial" as const) : ("ok" as const), summary: "4 discovered · 4 processed · 2 failed · 2 skipped" },
        { name: "Monday mailer", schedule: "Mondays, about 7:00 AM IST", lastRunAt: iso(world.now - 38 * 60_000), outcome: "ok" as const, summary: briefs.size ? "Brief sent to 1 recipient" : "Nothing to send yet" },
      ],
      quota: { youtubeUnitsUsed: 3120, youtubeUnitsLimit: 10000, geminiEpisodesToday: 4, geminiEpisodesLimit: 40, weeklyTokens: 1_840_000 },
      recipients: [world.settings.adminEmail],
      latestBriefWeek: latest,
      latestBriefSent: latest ? world.sentWeeks.has(latest) : false,
    };
  },

  async getLogs(opts) {
    const { world } = await store();
    return world.logs
      .filter((l) => (opts?.level ? l.level === opts.level : true))
      .map((l) => ({ id: l.id, at: iso(l.at), level: l.level, scope: l.scope, message: l.message, refLabel: l.refLabel }));
  },

  async getSettings() {
    return { ...(await store()).world.settings };
  },

  mutations: {
    async swapShow(outId, candidate) {
      const { world } = await store();
      const out = world.shows.find((s) => s.id === outId);
      if (!out || !isActive(out)) return fail("That show is not in the active lineup.");
      if (world.shows.some((s) => isActive(s) && s.name.toLowerCase() === candidate.name.toLowerCase())) return fail(`${candidate.name} is already in the lineup.`);
      const now = tick(world);
      out.intervals[out.intervals.length - 1].to = now;
      const existing = world.shows.find((s) => s.id === `show_${slug(candidate.name)}`);
      if (existing) existing.intervals.push({ from: now, to: null });
      else world.shows.push(candidateToShow(candidate, now));
      return ok(`Swapped. ${candidate.name} is tracked from now. New episodes appear after tonight's check.`);
    },
    async addShow(candidate) {
      const { world } = await store();
      const active = world.shows.filter(isActive).length;
      if (active >= world.settings.maxActiveShows) return fail(`You are at the cap of ${world.settings.maxActiveShows} shows. Swap or remove one first.`);
      if (world.shows.some((s) => isActive(s) && s.name.toLowerCase() === candidate.name.toLowerCase())) return fail(`${candidate.name} is already in the lineup.`);
      const now = tick(world);
      const existing = world.shows.find((s) => s.id === `show_${slug(candidate.name)}`);
      if (existing) existing.intervals.push({ from: now, to: null });
      else world.shows.push(candidateToShow(candidate, now));
      return ok(`Added ${candidate.name}. Tracked from now, with no backfill.`);
    },
    async removeShow(id) {
      const { world } = await store();
      const s = world.shows.find((x) => x.id === id);
      if (!s || !isActive(s)) return fail("That show is not in the active lineup.");
      s.intervals[s.intervals.length - 1].to = tick(world);
      return ok(`Removed ${s.name}. Its history is kept in Past shows.`);
    },
    async readdShow(id) {
      const { world } = await store();
      const s = world.shows.find((x) => x.id === id);
      if (!s || isActive(s)) return fail("That show is already active.");
      if (world.shows.filter(isActive).length >= world.settings.maxActiveShows) return fail("You are at the cap. Remove another show first.");
      s.intervals.push({ from: tick(world), to: null });
      return ok(`${s.name} is back. A new tracking period starts now, with no backfill.`);
    },
    async runWorkerNow() {
      const { world } = await store();
      if (world.workerRunning) return fail("The worker is already running.");
      world.lastWorkerAt = tick(world);
      return ok("Worker started (sample data: nothing actually runs). Check the queue and log for progress.");
    },
    async sendBriefNow({ resend }) {
      const { world } = await store();
      const week = world.briefWeeks[world.briefWeeks.length - 1];
      if (!week) return fail("There is no brief to send yet.");
      if (world.sentWeeks.has(week) && !resend) return fail("This brief was already sent. Choose Resend to send it again.");
      world.sentWeeks.add(week);
      tick(world);
      return ok(resend ? "Brief resent (sample data: no email actually goes out)." : "Brief sent (sample data: no email actually goes out).");
    },
    async rerunExtraction(id) {
      const { world } = await store();
      const e = world.episodes.find((x) => x.id === id);
      if (!e) return fail("Episode not found.");
      tick(world);
      return ok(`Queued a fresh extraction for "${e.title}" (sample data).`);
    },
    async retryFailedJobs() {
      const { world } = await store();
      tick(world);
      return ok("Failed jobs re-queued (sample data).");
    },
    async saveSettings(input) {
      const { world } = await store();
      const parsed = Settings.safeParse(input);
      if (!parsed.success) return fail("Some values are out of range. Check the highlighted fields.");
      if (parsed.data.minEpisodeMinutes >= parsed.data.maxEpisodeMinutes) return fail("The minimum length must be shorter than the maximum.");
      const active = world.shows.filter(isActive).length;
      if (parsed.data.maxActiveShows < active) return fail(`You have ${active} active shows. Remove some before lowering the cap to ${parsed.data.maxActiveShows}.`);
      world.settings = parsed.data;
      tick(world);
      return ok("Settings saved.");
    },
  },
};
