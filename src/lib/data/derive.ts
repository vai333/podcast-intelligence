// Read-side logic shared by the mock repo and the database repo. Both build a `World`
// (shows with intervals, episodes with their extracted guests/topics/sponsors) and these pure
// functions turn it into the DTOs the pages consume.
import { inActiveInterval, viewsPercentile } from "@/lib/scoring";
import { addDaysISO, daysBetween, startOfDayIST, weekStartIST } from "@/lib/time";
import { guestId, intervalMap, sponsorId, toRef, topicId } from "./mock/briefs";
import { DAY, type WEpisode, type WShow, type World } from "./mock/world";
import type {
  Brief,
  EpisodeQuery,
  EpisodeRow,
  EpisodeStatus,
  GuestDetail,
  GuestListItem,
  Lineup,
  Paged,
  Show,
  SponsorDetail,
  SponsorListItem,
  TopicDetail,
  TopicsOverview,
} from "./types";

export const PAGE_SIZE = 25;
export const iso = (ms: number) => new Date(ms).toISOString();
export const isActive = (s: WShow) => s.intervals.length > 0 && s.intervals[s.intervals.length - 1].to === null;

/** The most recent fully completed IST week (Monday), as of `now`. */
export const latestCompletedWeek = (now: number) => weekStartIST(now - 7 * DAY);

/** 12 week-starts ending with the latest completed week, oldest first. */
export const twelveWeeks = (now: number) => {
  const last = latestCompletedWeek(now);
  return Array.from({ length: 12 }, (_, i) => addDaysISO(last, -7 * (11 - i)));
};

export function toShow(w: World, s: WShow): Show {
  const eps = w.episodes.filter((e) => e.showId === s.id);
  const last = eps[0];
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    artworkUrl: s.artworkUrl ?? null,
    youtube: s.hasYoutube ? { channelId: s.channelId ?? "", handle: s.handle, subscribers: s.subscribers } : null,
    spotify: s.hasSpotify ? { showId: s.spotifyId ?? "" } : null,
    intervals: s.intervals.map((i) => ({ from: iso(i.from), to: i.to === null ? null : iso(i.to) })),
    active: isActive(s),
    episodes30d: eps.filter((e) => e.publishedAt > w.now - 30 * DAY).length,
    lastEpisodeAt: last ? iso(last.publishedAt) : null,
    health: s.health,
    healthNote:
      s.health === "quiet" && last
        ? `No new episode in ${Math.round((w.now - last.publishedAt) / DAY)} days. This may just be their schedule.`
        : s.healthNote,
    pastEpisodeCount: eps.length,
  };
}

export function episodeRow(w: World, e: WEpisode): EpisodeRow {
  const show = w.shows.find((s) => s.id === e.showId)!;
  const names = new Map(w.guests.map((x) => [x.key, x.name]));
  const sponsorNames = new Map(w.sponsors.map((x) => [x.key, x.name]));
  return {
    id: e.id,
    showId: e.showId,
    showName: show.name,
    title: e.title,
    publishedAt: iso(e.publishedAt),
    durationMin: e.durationMin,
    views: e.views,
    depth: e.depth,
    status: e.status as EpisodeStatus,
    statusNote: e.statusNote,
    youtubeUrl: e.youtubeUrl,
    spotifyUrl: e.spotifyUrl,
    guests: e.guestKeys.map((k) => names.get(k) ?? k),
    topics: e.topics,
    sponsors: e.sponsors.map((m) => sponsorNames.get(m.sponsorKey) ?? m.sponsorKey),
  };
}

export function listGuests(world: World, q?: string): GuestListItem[] {
  const map = intervalMap(world);
  const lo = world.now - 30 * DAY;
  const out = world.guests
    .map((gs) => {
      const eps = world.episodes.filter((e) => e.guestKeys.includes(gs.key));
      if (!eps.length) return null;
      const recent = eps.filter((e) => e.publishedAt > lo && inActiveInterval(e, map));
      const views = eps.map((e) => e.views).filter((v): v is number => v !== null);
      const shows30 = new Set(recent.map((e) => e.showId)).size;
      return {
        id: guestId(gs.key),
        name: gs.name,
        company: gs.company,
        appearances: eps.length,
        showsCount30d: shows30,
        lastSeen: iso(eps[0].publishedAt),
        topViews: views.length ? Math.max(...views) : null,
        mediaRound: shows30 >= 2,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const needle = q?.trim().toLowerCase();
  const filtered = needle ? out.filter((x) => `${x.name} ${x.company ?? ""}`.toLowerCase().includes(needle)) : out;
  return filtered.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export function getGuest(world: World, id: string, latest: Brief | null): GuestDetail | null {
  const seed = world.guests.find((x) => guestId(x.key) === id);
  if (!seed) return null;
  const eps = world.episodes.filter((e) => e.guestKeys.includes(seed.key));
  if (!eps.length) return null;
  const map = intervalMap(world);
  const lo = world.now - 30 * DAY;
  const recent = eps.filter((e) => e.publishedAt > lo && inActiveInterval(e, map));
  const allViews = world.episodes.filter((e) => e.publishedAt > lo && e.views !== null).map((e) => e.views as number);
  const top = Math.max(0, ...recent.map((e) => e.views ?? 0));
  const times = recent.map((e) => e.publishedAt);
  const inBrief = latest?.guests.find((x) => x.id === id) ?? null;
  const showIds = [...new Set(eps.map((e) => e.showId))];
  return {
    id,
    name: seed.name,
    company: seed.company,
    aliases: seed.aliases ?? [],
    mediaRound: new Set(recent.map((e) => e.showId)).size >= 2,
    showsCount30d: new Set(recent.map((e) => e.showId)).size,
    spanDays: times.length ? daysBetween(Math.max(...times), Math.min(...times)) : 0,
    viewsPercentile: top ? viewsPercentile(top, allViews) : 0,
    heat: inBrief?.heat ?? null,
    appearances: eps.map((e) => toRef(world, e)),
    lane: showIds.map((sid) => ({ showId: sid, showName: world.shows.find((s) => s.id === sid)!.name })),
  };
}

export function topicsOverview(world: World): TopicsOverview {
  const map = intervalMap(world);
  const weeks = twelveWeeks(world.now);
  const startMs = weeks.map((w) => startOfDayIST(w).getTime());
  const counts = new Map<string, number[]>();
  for (const e of world.episodes) {
    if (e.status !== "extracted" || !inActiveInterval(e, map)) continue;
    const wi = startMs.findIndex((s) => e.publishedAt >= s && e.publishedAt < s + 7 * DAY);
    if (wi < 0) continue;
    for (const t of e.topics) {
      const arr = counts.get(t) ?? Array(12).fill(0);
      arr[wi]++;
      counts.set(t, arr);
    }
  }
  const lo = world.now - 30 * DAY;
  const items = [...counts.entries()].map(([label, weekly]) => {
    const eps30 = world.episodes.filter((e) => e.topics.includes(label) && e.publishedAt > lo);
    const prev = (weekly[8] + weekly[9] + weekly[10]) / 3;
    return {
      id: topicId(label),
      label,
      weekly,
      total: weekly.reduce((a, b) => a + b, 0),
      showsCount30d: new Set(eps30.map((e) => e.showId)).size,
      rising: weekly[11] > prev,
    };
  });
  return { weeks, items: items.sort((a, b) => b.total - a.total) };
}

export function getTopic(world: World, id: string): TopicDetail | null {
  const overview = topicsOverview(world);
  const item = overview.items.find((t) => t.id === id);
  if (!item) return null;
  const eps = world.episodes.filter((e) => e.topics.includes(item.label));
  return {
    id,
    label: item.label,
    aliases: [],
    weeks: overview.weeks,
    weekly: item.weekly,
    shows: [...new Set(eps.map((e) => world.shows.find((s) => s.id === e.showId)!.name))],
    episodes: eps.map((e) => toRef(world, e)),
  };
}

export function listSponsors(world: World): SponsorListItem[] {
  const latestStart = startOfDayIST(latestCompletedWeek(world.now)).getTime();
  return world.sponsors
    .map((s) => {
      const rows = world.episodes.flatMap((e) => e.sponsors.filter((m) => m.sponsorKey === s.key).map((m) => ({ e, m })));
      if (!rows.length) return null;
      const times = rows.map((r) => r.e.publishedAt);
      return {
        id: sponsorId(s.key),
        name: s.name,
        firstSeenAt: iso(Math.min(...times)),
        lastSeenAt: iso(Math.max(...times)),
        showsCount: new Set(rows.map((r) => r.e.showId)).size,
        mentionsCount: rows.length,
        placements: [...new Set(rows.map((r) => r.m.placement))],
        activeThisWeek: Math.max(...times) >= latestStart,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function getSponsor(world: World, id: string): SponsorDetail | null {
  const seed = world.sponsors.find((s) => sponsorId(s.key) === id);
  if (!seed) return null;
  const rows = world.episodes.flatMap((e) => e.sponsors.filter((m) => m.sponsorKey === seed.key).map((m) => ({ e, m })));
  if (!rows.length) return null;
  const weeks = twelveWeeks(world.now);
  const weekly = weeks.map((w) => {
    const s = startOfDayIST(w).getTime();
    return rows.filter((r) => r.e.publishedAt >= s && r.e.publishedAt < s + 7 * DAY).length;
  });
  return {
    id,
    name: seed.name,
    aliases: seed.aliases ?? [],
    firstSeenAt: iso(Math.min(...rows.map((r) => r.e.publishedAt))),
    weeks,
    weekly,
    mentions: [...rows]
      .sort((a, b) => b.e.publishedAt - a.e.publishedAt)
      .map(({ e, m }) => ({
        episode: toRef(world, e),
        product: m.product,
        placement: m.placement,
        evidence: m.evidence,
        timestampSeconds: m.timestampSeconds,
        source: m.source,
      })),
  };
}

export function lineup(world: World): Lineup {
  const all = world.shows.map((s) => toShow(world, s));
  const windowStart = world.now - 12 * 7 * DAY;
  const changes = world.shows
    .flatMap((s) =>
      s.intervals.flatMap((iv, i) => [
        ...(i > 0 || iv.from > windowStart ? [{ at: iso(iv.from), kind: "added" as const, showName: s.name }] : []),
        ...(iv.to !== null ? [{ at: iso(iv.to), kind: "removed" as const, showName: s.name }] : []),
      ]),
    )
    .filter((c) => new Date(c.at).getTime() > windowStart)
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    active: all.filter((s) => s.active),
    past: all.filter((s) => !s.active),
    maxActive: world.settings.maxActiveShows,
    now: iso(world.now),
    windowStart: iso(windowStart),
    changes,
  };
}

export function listEpisodes(world: World, q: EpisodeQuery): Paged<EpisodeRow> {
  let rows = world.episodes.filter(
    (e) => (q.show ? e.showId === q.show : true) && (q.status ? e.status === q.status : true) && (q.depth ? e.depth === q.depth : true),
  );
  if (q.sort === "views") rows = [...rows].sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  const page = Math.max(1, q.page ?? 1);
  return {
    rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => episodeRow(world, e)),
    total: rows.length,
    page,
    pageSize: PAGE_SIZE,
  };
}
