// Composes frozen weekly briefs from the sample world using the real scoring module.
import {
  type IntervalMap,
  type ScoringEpisode,
  type Window,
  heatFor,
  inActiveInterval,
  lookbackEpisodes,
  scoreGuests,
  scoreSponsors,
  scoreTopics,
} from "@/lib/scoring";
import { addDaysISO, formatWeekOf, weekRangeIST } from "@/lib/time";
import type {
  Brief,
  BriefGuest,
  BriefSponsor,
  BriefTopic,
  EpisodeRef,
  LineupChange,
  SummaryBullet,
} from "../types";
import { COUNTER_ANGLES } from "./fixtures";
import { DAY, type WEpisode, type World } from "./world";

export const guestId = (key: string) => `g_${key}`;
export const topicId = (label: string) => `t_${label.replace(/[^a-z0-9]+/g, "-")}`;
export const sponsorId = (key: string) => `s_${key}`;

export function intervalMap(world: World): IntervalMap {
  return Object.fromEntries(world.shows.map((s) => [s.id, s.intervals]));
}

export function toRef(world: World, e: WEpisode): EpisodeRef {
  const show = world.shows.find((s) => s.id === e.showId)!;
  return {
    episodeId: e.id,
    showId: e.showId,
    showName: show.name,
    title: e.title,
    publishedAt: new Date(e.publishedAt).toISOString(),
    views: e.views,
    depth: e.depth,
    youtubeUrl: e.youtubeUrl,
    spotifyUrl: e.spotifyUrl,
  };
}

export function scoringEpisodes(world: World): ScoringEpisode[] {
  return world.episodes
    .filter((e) => e.status === "extracted")
    .map((e) => ({
      id: e.id,
      showId: e.showId,
      publishedAt: e.publishedAt,
      views: e.views,
      guestIds: e.guestKeys.map(guestId),
      topicIds: e.topics.map(topicId),
    }));
}

export function windowFor(world: World, weekStart: string): Window {
  const r = weekRangeIST(weekStart);
  return { weekStart: r.start.getTime(), weekEnd: r.end.getTime(), lookbackDays: world.settings.trendLookbackDays };
}

const byDateDesc = (a: EpisodeRef, b: EpisodeRef) => b.publishedAt.localeCompare(a.publishedAt);

function lineupChangesIn(world: World, w: Window): LineupChange[] {
  const out: LineupChange[] = [];
  for (const s of world.shows) {
    s.intervals.forEach((iv, i) => {
      // The very first interval is "seeded at the start", not a swap worth announcing.
      if (i > 0 || iv.from > w.weekStart - 14 * DAY) {
        if (iv.from >= w.weekStart && iv.from <= w.weekEnd) out.push({ kind: "added", showName: s.name, at: new Date(iv.from).toISOString() });
      }
      if (iv.to !== null && iv.to >= w.weekStart && iv.to <= w.weekEnd) {
        out.push({ kind: "removed", showName: s.name, at: new Date(iv.to).toISOString() });
      }
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export interface ComposeOptions {
  /** topic label -> counter-programming angle (AI-written in the real system). */
  angles?: Record<string, string>;
  /** Replaces the templated "What matters" bullets (AI-written in the real system). */
  summary?: SummaryBullet[];
  generatedAt?: Date;
  /** Treat this as the first week of tracking (hides New / Returning). Defaults to world.firstWeek. */
  firstWeek?: boolean;
}

export function composeBrief(world: World, weekStart: string, opts: ComposeOptions = {}): Brief {
  const isFirstWeek = opts.firstWeek ?? world.firstWeek;
  const map = intervalMap(world);
  const sEps = scoringEpisodes(world);
  const w = windowFor(world, weekStart);
  const epById = new Map(world.episodes.map((e) => [e.id, e]));
  const guestByKey = new Map(world.guests.map((g) => [guestId(g.key), g]));
  const inLookback = lookbackEpisodes(sEps, map, w);

  /* guests */
  const guests: BriefGuest[] = scoreGuests(sEps, map, w)
    .slice(0, 8)
    .map((g, i) => {
      const seed = guestByKey.get(g.guestId)!;
      const appearances = inLookback
        .filter((e) => e.guestIds.includes(g.guestId))
        .map((e) => toRef(world, epById.get(e.id)!))
        .sort(byDateDesc);
      return {
        id: g.guestId,
        name: seed.name,
        company: seed.company,
        aliases: seed.aliases ?? [],
        rank: i + 1,
        heat: heatFor(g.trendScore),
        trendScore: g.trendScore,
        showsCount: g.showsCount,
        spanDays: g.spanDays,
        mediaRound: g.mediaRound,
        viewsPercentile: g.viewsPercentile,
        topViews: g.topViews,
        components: { shows: Math.min(g.showsCount / 3, 1), views: g.viewsScore },
        appearances,
      };
    });

  /* topics */
  const topicRes = scoreTopics(sEps, map, w);
  const topicLabel = (id: string) => world.episodes.flatMap((e) => e.topics).find((t) => topicId(t) === id) ?? id;
  const topics: BriefTopic[] = topicRes.trending.slice(0, 6).map((t, i) => {
    const label = topicLabel(t.topicId);
    const refs = t.episodeIds.map((id) => toRef(world, epById.get(id)!)).sort(byDateDesc);
    return {
      id: t.topicId,
      label,
      rank: i + 1,
      heat: heatFor(t.trendScore),
      trendScore: t.trendScore,
      showsCount: t.showsCount,
      episodesCount: t.episodesCount,
      rising: t.rising ? { thisWeek: t.thisWeek, prevAvg: Math.round(t.prevAvg * 10) / 10 } : null,
      shows: [...new Set(refs.map((r) => r.showName))],
      episodes: refs.slice(0, 5),
      counterAngle: (opts.angles ?? COUNTER_ANGLES)[label] ?? null,
      components: { shows: Math.min(t.showsCount / 4, 1), episodes: Math.min(t.episodesCount / 6, 1), views: t.viewsScore },
    };
  });
  const emergingTopics = topicRes.emerging.slice(0, 4).map((t) => ({
    id: t.topicId,
    label: topicLabel(t.topicId),
    showsCount: t.showsCount,
    episodesCount: t.episodesCount,
    needs: t.needs,
  }));

  /* sponsors */
  const mentionRows = world.episodes.flatMap((e) =>
    e.sponsors.map((m) => ({ e, m, sid: sponsorId(m.sponsorKey) })),
  );
  const firstSeen: Record<string, number> = {};
  for (const { e, sid } of mentionRows) firstSeen[sid] = Math.min(firstSeen[sid] ?? Infinity, e.publishedAt);
  const sScores = scoreSponsors(
    mentionRows.map(({ e, sid }) => ({ episodeId: e.id, showId: e.showId, sponsorId: sid, publishedAt: e.publishedAt, views: e.views })),
    firstSeen,
    map,
    w,
  );
  const sponsors: BriefSponsor[] = sScores.slice(0, 10).map((s) => {
    const seed = world.sponsors.find((x) => sponsorId(x.key) === s.sponsorId)!;
    const mentions = mentionRows
      .filter(({ e, sid }) => sid === s.sponsorId && s.episodeIds.includes(e.id))
      .map(({ e, m }) => ({
        episode: toRef(world, e),
        product: m.product,
        placement: m.placement,
        evidence: m.evidence,
        timestampSeconds: m.timestampSeconds,
        source: m.source,
      }));
    return {
      id: s.sponsorId,
      name: seed.name,
      status: s.status,
      firstSeenAt: new Date(firstSeen[s.sponsorId]).toISOString(),
      showsCount: s.showsCount,
      totalViews: s.totalViews,
      placements: [...new Set(mentions.map((m) => m.placement))],
      mentions,
    };
  });

  /* coverage for the week */
  const weekEps = world.episodes.filter((e) => e.publishedAt >= w.weekStart && e.publishedAt <= w.weekEnd && inActiveInterval(e, map));
  const coverage = {
    episodesFound: weekEps.length,
    analyzedVideo: weekEps.filter((e) => e.status === "extracted" && e.depth === "video").length,
    analyzedMetadata: weekEps.filter((e) => e.status === "extracted" && e.depth === "metadata").length,
    skippedOrFailed: weekEps.filter((e) => e.status !== "extracted").length,
  };

  // Seeding the initial lineup is not a swap worth announcing.
  const lineupChanges = isFirstWeek ? [] : lineupChangesIn(world, w);

  /* summary bullets (AI-written in the real system; templated here) */
  const summary: SummaryBullet[] = opts.summary ? [...opts.summary] : [];
  const templated = !opts.summary;
  const g0 = templated ? guests[0] : undefined;
  if (g0) {
    summary.push({
      text: g0.mediaRound
        ? `${g0.name} appeared on ${g0.showsCount} shows within ${Math.max(g0.spanDays, 1)} days, which suggests a media round and a good moment to book.`
        : `${g0.name}'s episode is in the top ${Math.max(100 - g0.viewsPercentile, 1)}% by views this month.`,
      refs: [{ kind: "guest", id: g0.id, label: g0.name }],
    });
  }
  const g1 = templated ? guests.find((g, i) => i > 0 && g.mediaRound) : undefined;
  if (g1) {
    summary.push({
      text: `${g1.name} is also making the rounds: ${g1.showsCount} shows in ${Math.max(g1.spanDays, 1)} days.`,
      refs: [{ kind: "guest", id: g1.id, label: g1.name }],
    });
  }
  const t0 = templated ? (topics.find((t) => t.rising) ?? topics[0]) : undefined;
  if (t0) {
    summary.push({
      text: `"${t0.label}" ${t0.rising ? "is rising" : "is trending"}: ${t0.episodesCount} episodes across ${t0.showsCount} shows in 30 days.`,
      refs: [{ kind: "topic", id: t0.id, label: t0.label }],
    });
  }
  const newSponsors = sponsors.filter((s) => s.status === "new");
  const sp0 = templated ? sponsors[0] : undefined;
  if (sp0) {
    summary.push({
      text:
        newSponsors.length && !isFirstWeek
          ? `${newSponsors.length} new sponsor${newSponsors.length > 1 ? "s" : ""} this week. ${sp0.name} is on ${sp0.showsCount} show${sp0.showsCount > 1 ? "s" : ""}.`
          : `${sp0.name} is the most active sponsor, on ${sp0.showsCount} show${sp0.showsCount > 1 ? "s" : ""}.`,
      refs: [{ kind: "sponsor", id: sp0.id, label: sp0.name }],
    });
  }

  const idx = world.briefWeeks.indexOf(weekStart);
  const generated = opts.generatedAt ?? new Date(weekRangeIST(addDaysISO(weekStart, 7)).start.getTime() + 52 * 60_000);
  return {
    weekStart,
    weekEnd: addDaysISO(weekStart, 6),
    generatedAt: generated.toISOString(),
    sentAt: world.sentWeeks.has(weekStart) ? new Date(generated.getTime() + 6 * 3_600_000 + 12 * 60_000).toISOString() : null,
    isLatest: idx === world.briefWeeks.length - 1,
    isFirstWeek,
    coverage,
    lineupChanges,
    summary,
    guests,
    topics,
    emergingTopics,
    sponsors,
    prevWeek: idx > 0 ? world.briefWeeks[idx - 1] : null,
    nextWeek: idx >= 0 && idx < world.briefWeeks.length - 1 ? world.briefWeeks[idx + 1] : null,
  };
}

export function briefHeadline(b: Brief): string {
  const g = b.guests[0];
  const t = b.topics.find((x) => x.rising) ?? b.topics[0];
  const parts = [g && `${g.name}${g.mediaRound ? " on a media round" : ""}`, t && `"${t.label}" ${t.rising ? "rising" : "trending"}`];
  return parts.filter(Boolean).join(" · ") || `${formatWeekOf(b.weekStart)}: quiet week`;
}
