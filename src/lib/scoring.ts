// Pure scoring per spec section 8.2. No I/O, so the real backend can reuse it unchanged.
import type { Heat } from "./data/types";

const DAY_MS = 86_400_000;

export interface Interval {
  from: number; // ms epoch
  to: number | null;
}
export type IntervalMap = Record<string, Interval[]>;

export interface ScoringEpisode {
  id: string;
  showId: string;
  publishedAt: number; // ms epoch
  views: number | null; // YouTube only
  guestIds: string[];
  topicIds: string[];
}

export interface Window {
  /** Start of the 7-day "fresh" week (Mon 00:00 IST). */
  weekStart: number;
  /** End of that week (Sun 23:59:59.999 IST). */
  weekEnd: number;
  lookbackDays: number;
}

/** An episode only counts if its show was active when it was published. */
export function inActiveInterval(ep: Pick<ScoringEpisode, "showId" | "publishedAt">, map: IntervalMap): boolean {
  const intervals = map[ep.showId] ?? [];
  return intervals.some((i) => ep.publishedAt >= i.from && (i.to === null || ep.publishedAt <= i.to));
}

export function lookbackEpisodes(all: ScoringEpisode[], map: IntervalMap, w: Window): ScoringEpisode[] {
  const lo = w.weekEnd - w.lookbackDays * DAY_MS;
  return all.filter((e) => e.publishedAt > lo && e.publishedAt <= w.weekEnd && inActiveInterval(e, map));
}

export function isFresh(e: ScoringEpisode, w: Window): boolean {
  return e.publishedAt >= w.weekStart && e.publishedAt <= w.weekEnd;
}

/** log-scaled 0..1 against the biggest episode in the window. */
export function viewsScore(views: number | null, maxViews: number): number {
  if (!views || maxViews <= 0) return 0;
  return Math.min(1, Math.log1p(views) / Math.log1p(maxViews));
}

/** Share (0..100) of window episodes with strictly fewer views. */
export function viewsPercentile(views: number | null, allViews: number[]): number {
  if (views === null || allViews.length === 0) return 0;
  const below = allViews.filter((v) => v < views).length;
  return Math.round((below / allViews.length) * 100);
}

export function heatFor(score: number): Heat {
  if (score >= 0.7) return "strong";
  if (score >= 0.45) return "medium";
  return "emerging";
}

const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);

/* ------------------------------ guests ------------------------------ */

export interface GuestScore {
  guestId: string;
  episodeIds: string[];
  showIds: string[];
  showsCount: number;
  spanDays: number;
  topViews: number | null;
  viewsScore: number;
  viewsPercentile: number;
  mediaRound: boolean;
  trendScore: number;
}

export function scoreGuests(all: ScoringEpisode[], map: IntervalMap, w: Window): GuestScore[] {
  const eps = lookbackEpisodes(all, map, w);
  const allViews = eps.map((e) => e.views).filter((v): v is number => v !== null);
  const maxViews = maxOf(allViews);

  const byGuest = new Map<string, ScoringEpisode[]>();
  for (const e of eps) for (const g of e.guestIds) byGuest.set(g, [...(byGuest.get(g) ?? []), e]);

  const out: GuestScore[] = [];
  for (const [guestId, list] of byGuest) {
    if (!list.some((e) => isFresh(e, w))) continue; // must be fresh this week
    const showIds = [...new Set(list.map((e) => e.showId))];
    const views = list.map((e) => e.views).filter((v): v is number => v !== null);
    const topViews = views.length ? Math.max(...views) : null;
    const vScore = viewsScore(topViews, maxViews);
    const pct = viewsPercentile(topViews, allViews);
    const mediaRound = showIds.length >= 2;
    if (!(mediaRound || pct >= 90)) continue;
    const times = list.map((e) => e.publishedAt);
    out.push({
      guestId,
      episodeIds: list.map((e) => e.id),
      showIds,
      showsCount: showIds.length,
      spanDays: Math.round((Math.max(...times) - Math.min(...times)) / DAY_MS),
      topViews,
      viewsScore: vScore,
      viewsPercentile: pct,
      mediaRound,
      trendScore: 0.6 * Math.min(showIds.length / 3, 1) + 0.4 * vScore,
    });
  }
  return out.sort((a, b) => b.trendScore - a.trendScore || b.showsCount - a.showsCount);
}

/* ------------------------------ topics ------------------------------ */

export interface TopicScore {
  topicId: string;
  episodeIds: string[];
  showIds: string[];
  showsCount: number;
  episodesCount: number;
  thisWeek: number;
  prevAvg: number;
  rising: boolean;
  viewsScore: number;
  trendScore: number;
}

export interface TopicResult {
  trending: TopicScore[];
  emerging: (TopicScore & { needs: string })[];
}

export function scoreTopics(all: ScoringEpisode[], map: IntervalMap, w: Window): TopicResult {
  const eps = lookbackEpisodes(all, map, w);
  const allViews = eps.map((e) => e.views).filter((v): v is number => v !== null);
  const maxViews = maxOf(allViews);

  // For "rising" we compare against the three weeks before this one, independent of lookback.
  const prevWeekCount = (topicId: string, back: number) => {
    const lo = w.weekStart - back * 7 * DAY_MS;
    const hi = lo + 7 * DAY_MS;
    return all.filter(
      (e) => e.publishedAt >= lo && e.publishedAt < hi && e.topicIds.includes(topicId) && inActiveInterval(e, map),
    ).length;
  };

  const byTopic = new Map<string, ScoringEpisode[]>();
  for (const e of eps) for (const t of e.topicIds) byTopic.set(t, [...(byTopic.get(t) ?? []), e]);

  const trending: TopicScore[] = [];
  const emerging: (TopicScore & { needs: string })[] = [];

  for (const [topicId, list] of byTopic) {
    const fresh = list.filter((e) => isFresh(e, w));
    if (fresh.length === 0) continue;
    const showIds = [...new Set(list.map((e) => e.showId))];
    const views = list.map((e) => e.views).filter((v): v is number => v !== null);
    const vScore = viewsScore(views.length ? Math.max(...views) : null, maxViews);
    const prevAvg = (prevWeekCount(topicId, 1) + prevWeekCount(topicId, 2) + prevWeekCount(topicId, 3)) / 3;
    const score: TopicScore = {
      topicId,
      episodeIds: list.map((e) => e.id),
      showIds,
      showsCount: showIds.length,
      episodesCount: list.length,
      thisWeek: fresh.length,
      prevAvg,
      rising: fresh.length > prevAvg,
      viewsScore: vScore,
      trendScore: 0.5 * Math.min(showIds.length / 4, 1) + 0.3 * Math.min(list.length / 6, 1) + 0.2 * vScore,
    };
    if (showIds.length >= 2 && list.length >= 3) {
      trending.push(score);
    } else if (list.length >= 2 || showIds.length >= 2) {
      const needs =
        showIds.length < 2
          ? "1 more show"
          : list.length < 3
            ? `${3 - list.length} more episode${3 - list.length > 1 ? "s" : ""}`
            : "more coverage";
      emerging.push({ ...score, needs });
    }
  }
  trending.sort((a, b) => b.trendScore - a.trendScore);
  emerging.sort((a, b) => b.trendScore - a.trendScore);
  return { trending, emerging };
}

/* ------------------------------ sponsors ------------------------------ */

export interface SponsorEpisodeInput {
  episodeId: string;
  showId: string;
  sponsorId: string;
  publishedAt: number;
  views: number | null;
}

export interface SponsorScore {
  sponsorId: string;
  showsCount: number;
  totalViews: number;
  status: "new" | "returning";
  episodeIds: string[];
}

/** Sponsors seen in the fresh week, ranked by distinct shows then total views. */
export function scoreSponsors(
  rows: SponsorEpisodeInput[],
  firstSeen: Record<string, number>,
  map: IntervalMap,
  w: Window,
): SponsorScore[] {
  const fresh = rows.filter(
    (r) => r.publishedAt >= w.weekStart && r.publishedAt <= w.weekEnd && inActiveInterval(r, map),
  );
  const bySponsor = new Map<string, SponsorEpisodeInput[]>();
  for (const r of fresh) bySponsor.set(r.sponsorId, [...(bySponsor.get(r.sponsorId) ?? []), r]);
  const out: SponsorScore[] = [];
  for (const [sponsorId, list] of bySponsor) {
    const epIds = [...new Set(list.map((r) => r.episodeId))];
    const seenViews = new Map(list.map((r) => [r.episodeId, r.views ?? 0]));
    out.push({
      sponsorId,
      showsCount: new Set(list.map((r) => r.showId)).size,
      totalViews: epIds.reduce((s, id) => s + (seenViews.get(id) ?? 0), 0),
      status: (firstSeen[sponsorId] ?? w.weekStart) >= w.weekStart ? "new" : "returning",
      episodeIds: epIds,
    });
  }
  return out.sort((a, b) => b.showsCount - a.showsCount || b.totalViews - a.totalViews);
}
