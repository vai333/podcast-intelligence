// Builds a deterministic sample "world" (shows, episodes, extractions, logs) from the fixtures.
// Includes the awkward cases on purpose: metadata-only, failed and skipped episodes, a very long
// guest name, a show with two intervals, a swapped-out show, New vs Returning sponsors,
// a missing-artwork show, a show with a broken channel, and a quiet show.
import { addDaysISO, startOfDayIST } from "@/lib/time";
import type { MockScenario, Placement } from "../types";
import {
  EXTRA_GUESTS,
  FAILURE_NOTES,
  GUESTS,
  SHOWS,
  SKIP_NOTES,
  SPONSORS,
  TITLE_TEMPLATES,
  TOPICS,
  type GuestSeed,
} from "./fixtures";
import { type Rng, idChars, mulberry32, normal, pick, slug, weightedPick } from "./rng";

export const DAY = 86_400_000;
/** The app's fixed "now": Monday 12 Oct 2026, 7:10 AM IST (just after the Monday email). */
export const MOCK_NOW = Date.UTC(2026, 9, 12, 1, 40);
export const LATEST_WEEK = "2026-10-05";
export const BRIEF_WEEKS = 12;
const GEN_WEEKS = 17; // extra weeks so the earliest brief has a full lookback and "prev 3 weeks"

export interface WInterval {
  from: number;
  to: number | null;
}

export interface WShow {
  id: string;
  name: string;
  description: string;
  handle: string;
  subscribers: number;
  hasYoutube: boolean;
  hasSpotify: boolean;
  health: "ok" | "quiet" | "error";
  healthNote: string | null;
  intervals: WInterval[];
  channelId: string | null;
  spotifyId: string | null;
  artworkUrl?: string | null;
}

export interface WSponsorSeed {
  key: string;
  name: string;
  aliases?: string[];
}

export interface WSponsorMention {
  sponsorKey: string;
  product: string;
  placement: Placement;
  evidence: string;
  timestampSeconds: number | null;
  source: "video" | "description";
}

export interface WEpisode {
  id: string;
  showId: string;
  title: string;
  publishedAt: number;
  durationMin: number;
  views: number | null;
  depth: "video" | "metadata";
  status: "extracted" | "failed" | "skipped" | "discovered";
  statusNote: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  guestKeys: string[];
  topics: string[];
  sponsors: WSponsorMention[];
}

export interface WLog {
  id: string;
  at: number;
  level: "info" | "warn" | "error";
  scope: "show" | "episode" | "api" | "queue" | "email";
  message: string;
  refLabel: string | null;
}

export interface World {
  scenario: MockScenario;
  now: number;
  shows: WShow[];
  episodes: WEpisode[];
  guests: GuestSeed[];
  sponsors: WSponsorSeed[];
  logs: WLog[];
  briefWeeks: string[]; // oldest -> newest
  firstWeek: boolean;
  lastDataAt: number;
  sentWeeks: Set<string>;
  workerRunning: boolean;
  lastWorkerAt: number;
  settings: {
    maxActiveShows: number;
    minEpisodeMinutes: number;
    maxEpisodeMinutes: number;
    trendLookbackDays: number;
    adminEmail: string;
  };
}

const latestWeekStartMs = startOfDayIST(LATEST_WEEK).getTime();

export function briefWeekList(): string[] {
  return Array.from({ length: BRIEF_WEEKS }, (_, i) => addDaysISO(LATEST_WEEK, -7 * (BRIEF_WEEKS - 1 - i)));
}

function buildShows(scenario: MockScenario): WShow[] {
  return SHOWS.map((s, i) => {
    let intervals: WInterval[];
    if (scenario === "full") {
      intervals = s.intervalsWeeksAgo.map((iv) => ({
        from: MOCK_NOW - iv.from * 7 * DAY - DAY / 2,
        to: iv.to === null ? null : MOCK_NOW - iv.to * 7 * DAY - DAY / 2,
      }));
    } else if (scenario === "first-week") {
      intervals = [{ from: latestWeekStartMs, to: null }];
    } else {
      intervals = [{ from: MOCK_NOW - DAY, to: null }];
    }
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      handle: s.handle,
      subscribers: s.subscribers,
      hasYoutube: s.hasYoutube,
      hasSpotify: s.hasSpotify,
      health: scenario === "full" ? s.health : "ok",
      healthNote: scenario === "full" ? s.healthNote : null,
      intervals,
      channelId: s.hasYoutube ? `UC${slug(s.name).slice(0, 10)}${i}` : null,
      spotifyId: s.hasSpotify ? `sp_${slug(s.name).slice(0, 12)}` : null,
    };
  });
}

const inIntervals = (t: number, ivs: WInterval[]) => ivs.some((iv) => t >= iv.from && (iv.to === null || t <= iv.to));

function evidenceFor(placement: Placement, name: string, pitch: string): string {
  switch (placement) {
    case "host_read":
      return `Quick word from our sponsor ${name}: ${pitch}, and my listeners get ten percent off.`;
    case "pre_roll":
      return `This episode is brought to you by ${name}, the easiest way to ${pitch}.`;
    case "mid_roll":
      return `Before we continue, a word from ${name}. Use my code to ${pitch}.`;
    case "post_roll":
      return `Thanks to ${name} for supporting this episode. Go check them out.`;
    case "on_screen":
      return `Sponsor card on screen: ${name}, ${pitch}.`;
    default:
      return `Sponsor: ${name} - ${pitch}. Link in the description.`;
  }
}

export function generateWorld(scenario: MockScenario): World {
  const r: Rng = mulberry32(scenario === "full" ? 20261012 : scenario === "first-week" ? 77 : 5);
  const shows = buildShows(scenario);
  const episodes: WEpisode[] = [];
  const guestCount = new Map<string, number>();
  const hotGuests = new Set(["priya", "arjun", "kabir", "sana"]);
  const allGuests = [...GUESTS, ...EXTRA_GUESTS];
  const guestPool = allGuests.filter((g) => !hotGuests.has(g.key));
  const showById = new Map(shows.map((s) => [s.id, s]));
  const seedById = new Map(SHOWS.map((s) => [s.id, s]));
  let epSeq = 0;

  const makeEpisode = (
    showId: string,
    publishedAt: number,
    opts: {
      guests?: string[];
      topics?: string[];
      sponsors?: string[];
      status?: WEpisode["status"];
      note?: string | null;
      forceVideoFallback?: boolean;
      fameBoost?: number;
    } = {},
  ): WEpisode => {
    const seed = seedById.get(showId)!;
    const show = showById.get(showId)!;
    const ageDays = (MOCK_NOW - publishedAt) / DAY;
    const status = opts.status ?? "extracted";
    const extracted = status === "extracted";

    // guests
    let guestKeys = opts.guests;
    if (!guestKeys) {
      const g1 = weightedPick(r, guestPool, (g) => 1 / (1 + (guestCount.get(g.key) ?? 0)) ** 5);
      guestKeys = [g1.key];
      if (r() < 0.1) {
        const g2 = weightedPick(r, guestPool, (g) => (g.key === g1.key ? 0 : 1));
        guestKeys.push(g2.key);
      }
    }
    if (extracted) for (const k of guestKeys) guestCount.set(k, (guestCount.get(k) ?? 0) + 1);

    // topics with a time trend: "ai agents" rising, "quick commerce" cooling, "d2c" surging lately
    const recency = Math.max(0, 1 - ageDays / (GEN_WEEKS * 7));
    const topicWeight = (t: string) => {
      if (t === "ai agents for smb") return 0.3 + 1.6 * recency * recency;
      if (t === "quick commerce") return 2.2 - 1.8 * recency;
      if (t === "d2c brand scaling") return ageDays < 14 ? 3.2 : 1.1;
      if (t === "climate hardware" || t === "tier-2 consumer markets") return ageDays < 9 ? 0.5 : 0.08;
      if (t === "fintech compliance") return 0.3;
      if (t === "hiring first ten") return ageDays < 10 ? 1.7 : 0.9;
      return 1;
    };
    let topics = opts.topics;
    if (!topics) {
      topics = [];
      const lead = weightedPick(r, TOPICS, topicWeight);
      topics.push(lead);
      while (topics.length < 3 + (r() < 0.4 ? 1 : 0)) {
        const t = weightedPick(r, TOPICS, (x) => (topics!.includes(x) ? 0 : topicWeight(x)));
        topics.push(t);
      }
    }

    const hasYT = show.hasYoutube;
    const depth: WEpisode["depth"] = hasYT && !opts.forceVideoFallback ? "video" : "metadata";

    // views: YouTube only
    const fame = Math.max(...guestKeys.map((k) => allGuests.find((g) => g.key === k)?.fame ?? 1), 1) * (opts.fameBoost ?? 1);
    const ageFactor = Math.min(1, 0.25 + ageDays / 10);
    const views = hasYT ? Math.max(300, Math.round(seed.baseViews * fame * Math.exp(0.55 * normal(r)) * ageFactor)) : null;

    // sponsors
    const sponsors: WSponsorMention[] = [];
    if (extracted) {
      const wanted = opts.sponsors ?? [];
      let n = wanted.length ? 0 : r() < 0.42 ? 0 : r() < 0.72 ? 1 : 2;
      const chosen = new Set<string>(wanted);
      while (n > 0) {
        const s = weightedPick(r, SPONSORS, (x) => (x.onlyLatestWeek || chosen.has(x.key) ? 0 : x.weight));
        chosen.add(s.key);
        n--;
      }
      const duration = 22 + Math.floor(r() * 70);
      for (const key of chosen) {
        const s = SPONSORS.find((x) => x.key === key)!;
        const fromVideo = depth === "video" && r() > 0.15;
        const placement: Placement = fromVideo
          ? pick(r, ["host_read", "pre_roll", "mid_roll", "post_roll", "on_screen"] as const)
          : "description_link";
        const ts =
          !fromVideo || placement === "on_screen"
            ? placement === "on_screen"
              ? 300 + Math.floor(r() * 1800)
              : null
            : placement === "pre_roll"
              ? 20 + Math.floor(r() * 70)
              : placement === "mid_roll"
                ? Math.floor(duration * 60 * (0.35 + r() * 0.2))
                : placement === "post_roll"
                  ? Math.max(60, duration * 60 - 60 - Math.floor(r() * 120))
                  : 120 + Math.floor(r() * 480);
        sponsors.push({
          sponsorKey: key,
          product: s.products[0],
          placement,
          evidence: evidenceFor(placement, s.name, s.pitch),
          timestampSeconds: ts,
          source: fromVideo ? "video" : "description",
        });
      }
    }

    const lead = allGuests.find((g) => g.key === guestKeys![0])!;
    const title = pick(r, TITLE_TEMPLATES)(lead.name.split(" ").slice(0, 2).join(" "), topics[0], lead.company?.split(", ").pop() ?? null);
    const id = `ep_${String(++epSeq).padStart(3, "0")}`;
    const ytId = hasYT ? idChars(r, 11) : null;
    const spId = show.hasSpotify ? idChars(r, 22) : null;

    return {
      id,
      showId,
      title: status === "skipped" ? `${title.split(":")[0]} (clip)` : title,
      publishedAt,
      durationMin: status === "skipped" ? (opts.note?.startsWith("Shorter") ? 9 : 138) : 24 + Math.floor(r() * 68),
      views,
      depth,
      status,
      statusNote: opts.note ?? null,
      youtubeUrl: ytId ? `https://www.youtube.com/watch?v=${ytId}` : null,
      spotifyUrl: spId ? `https://open.spotify.com/episode/${spId}` : null,
      guestKeys: extracted ? guestKeys : [],
      topics: extracted ? topics : [],
      sponsors,
    };
  };

  if (scenario !== "empty") {
    // regular cadence per show per week, oldest week first
    const firstK = scenario === "first-week" ? 0 : GEN_WEEKS - 1;
    for (let k = firstK; k >= 0; k--) {
      const weekStartMs = latestWeekStartMs - k * 7 * DAY;
      for (const seed of SHOWS) {
        const show = showById.get(seed.id)!;
        const base = Math.floor(seed.cadence);
        const n = base + (r() < seed.cadence - base ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const day = 1 + Math.floor(r() * 5);
          const t = weekStartMs + day * DAY + (4 + Math.floor(r() * 9)) * 3_600_000 + Math.floor(r() * 3_600_000);
          if (t > MOCK_NOW || !inIntervals(t, show.intervals)) continue;
          // The Indian Dream is "quiet": nothing in the last 18 days.
          if (scenario === "full" && seed.id === "show_indiandream" && MOCK_NOW - t < 18 * DAY) continue;
          // SeedToScale channel went unreachable on 9 Oct.
          if (scenario === "full" && seed.id === "show_seedtoscale" && t > Date.UTC(2026, 9, 8, 18, 30)) continue;
          episodes.push(makeEpisode(seed.id, t));
        }
      }
    }

    // planted stories in the latest weeks (full + first-week share the latest-week ones)
    const day = (k: number, d: number, h = 8) => latestWeekStartMs - k * 7 * DAY + d * DAY + h * 3_600_000;
    if (scenario === "full") {
      const showsOk = (id: string, t: number) => inIntervals(t, showById.get(id)!.intervals);
      const plant = (id: string, t: number, opts: Parameters<typeof makeEpisode>[2]) => {
        if (showsOk(id, t)) episodes.push(makeEpisode(id, t, opts));
      };
      // Priya Raghavan: 3 shows in 11 days (media round)
      plant("show_barbershop", day(1, 2), { guests: ["priya"], topics: ["d2c brand scaling", "founder-led sales", "seed fundraising"], fameBoost: 1.4 });
      plant("show_desivc", day(0, 0, 9), { guests: ["priya"], topics: ["d2c brand scaling", "bootstrapping vs vc", "tier-2 consumer markets"] });
      plant("show_neon", day(0, 4, 7), { guests: ["priya"], topics: ["d2c brand scaling", "hiring first ten", "quick commerce"], fameBoost: 1.5 });
      // Arjun: one show, huge views (top 10%)
      plant("show_barbershop", day(0, 3, 10), { guests: ["arjun"], topics: ["ai agents for smb", "ai in customer support", "founder-led sales"], fameBoost: 2.2 });
      // Kabir: 2 shows, 3 days apart
      plant("show_isv", day(0, 1, 11), { guests: ["kabir"], topics: ["fintech compliance", "b2b saas pricing", "seed fundraising"] });
      plant("show_firstprinciples", day(0, 4, 6), { guests: ["kabir"], topics: ["fintech compliance", "ai agents for smb", "hiring first ten"] });
      // Sana: 2 shows across weeks, one on a re-added show
      plant("show_zerotoinfinity", day(1, 3, 9), { guests: ["sana"], topics: ["creator economy", "d2c brand scaling", "bootstrapping vs vc"] });
      plant("show_founderthesis", day(0, 2, 12), { guests: ["sana"], topics: ["creator economy", "d2c brand scaling", "hiring first ten"] });
      // New sponsors: Grofin on 3 shows, StackPilot on 2, all in the latest week
      const latestWeekEps = episodes.filter(
        (e) => e.publishedAt >= latestWeekStartMs && e.status === "extracted" && e.depth === "video",
      );
      const byShow = new Map<string, WEpisode>();
      for (const e of latestWeekEps) if (!byShow.has(e.showId)) byShow.set(e.showId, e);
      const targets = [...byShow.values()];
      const attach = (e: WEpisode | undefined, key: string) => {
        if (!e || e.sponsors.some((s) => s.sponsorKey === key)) return;
        const s = SPONSORS.find((x) => x.key === key)!;
        const placement: Placement = key === "grofin" ? "host_read" : "pre_roll";
        e.sponsors.push({
          sponsorKey: key,
          product: s.products[0],
          placement,
          evidence: evidenceFor(placement, s.name, s.pitch),
          timestampSeconds: placement === "host_read" ? 240 : 45,
          source: "video",
        });
      };
      targets.slice(0, 3).forEach((e) => attach(e, "grofin"));
      targets.slice(2, 4).forEach((e) => attach(e, "stackpilot"));
    }

    // ugly cases in the latest week: 2 failed, 2 skipped, 1 video-unavailable fallback
    const latest = episodes
      .filter((e) => e.publishedAt >= latestWeekStartMs && !e.guestKeys.some((k) => hotGuests.has(k)))
      .sort((a, b) => a.id.localeCompare(b.id));
    const mark = (idx: number, patch: Partial<WEpisode>) => {
      const e = latest[idx];
      if (e) Object.assign(e, patch, { guestKeys: [], topics: [], sponsors: [] });
    };
    if (latest.length >= 7) {
      mark(1, { status: "failed", statusNote: FAILURE_NOTES[0] });
      mark(5, { status: "failed", statusNote: FAILURE_NOTES[1] });
      mark(3, { status: "skipped", statusNote: SKIP_NOTES[0], durationMin: 138 });
      mark(6, { status: "skipped", statusNote: SKIP_NOTES[1], durationMin: 9 });
      const fb = latest[2];
      if (fb && fb.youtubeUrl && fb.status === "extracted") fb.depth = "metadata";
    }
  }

  // sample logs (newest first when displayed)
  const t = (hoursAgo: number) => MOCK_NOW - hoursAgo * 3_600_000;
  const failed = episodes.filter((e) => e.status === "failed").slice(0, 2);
  const skipped = episodes.filter((e) => e.status === "skipped").slice(0, 2);
  const logs: WLog[] = [];
  const log = (hoursAgo: number, level: WLog["level"], scope: WLog["scope"], message: string, refLabel: string | null = null) =>
    logs.push({ id: `log_${logs.length + 1}`, at: t(hoursAgo), level, scope, message, refLabel });

  if (scenario === "full") {
    log(0.1, "info", "email", "Weekly brief for 5 to 11 Oct sent to 1 recipient.", "Brief 5 Oct");
    log(0.4, "info", "queue", "Weekly analysis finished: 12 guests scored, 6 topics, 9 sponsors.");
    log(0.5, "info", "queue", "Queue drained. 34 extract jobs done, 2 failed, 2 skipped.");
    for (const e of failed) log(1.1, "error", "episode", `${e.statusNote} (2 attempts)`, e.title);
    for (const e of skipped) log(1.4, "warn", "episode", e.statusNote ?? "Skipped.", e.title);
    log(2.2, "error", "show", "YouTube channel not reachable (404). Will retry on the next run.", "SeedToScale");
    log(2.4, "info", "api", "YouTube quota at 31% of the daily limit. Discovery continued.");
    log(2.6, "info", "show", "Discovered 3 new episodes.", "The Barbershop with Shantanu");
    log(2.7, "info", "show", "Discovered 2 new episodes.", "The Neon Show");
    log(2.8, "info", "show", "No new episodes since the last check.", "The Indian Dream");
    log(26, "warn", "episode", "Video unavailable to Gemini. Fell back to title and description.", "Metadata fallback");
    log(27, "info", "queue", "Worker run finished: 4 discovered, 4 processed, 0 failed.");
    log(51, "info", "queue", "Worker run finished: 2 discovered, 2 processed, 0 failed.");
    log(74, "warn", "api", "Spotify returned 429. Retried after 2s and succeeded.");
    log(75, "info", "queue", "Worker run finished: 5 discovered, 5 processed, 0 failed.");
    log(98, "error", "email", "Resend returned a temporary error. Brief stays unsent and can be retried.", "Brief 28 Sep");
  } else {
    log(0.5, "info", "queue", "Worker run finished: 0 discovered, 0 processed.");
  }
  logs.sort((a, b) => b.at - a.at);

  return {
    scenario,
    now: MOCK_NOW,
    shows,
    episodes: episodes.sort((a, b) => b.publishedAt - a.publishedAt),
    guests: allGuests,
    sponsors: SPONSORS.map((x) => ({ key: x.key, name: x.name, aliases: x.aliases })),
    logs,
    briefWeeks: scenario === "full" ? briefWeekList() : scenario === "first-week" ? [LATEST_WEEK] : [],
    firstWeek: scenario === "first-week",
    lastDataAt: MOCK_NOW - 6 * 3_600_000,
    sentWeeks: new Set(
      (scenario === "full" ? briefWeekList() : scenario === "first-week" ? [LATEST_WEEK] : []).filter(
        (w) => w !== "2026-09-28",
      ),
    ),
    workerRunning: false,
    lastWorkerAt: MOCK_NOW - 6.5 * 3_600_000,
    settings: {
      maxActiveShows: 10,
      minEpisodeMinutes: 15,
      maxEpisodeMinutes: 120,
      trendLookbackDays: 30,
      adminEmail: "aditya@example.com",
    },
  };
}
