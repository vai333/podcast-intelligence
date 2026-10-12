import { describe, expect, it } from "vitest";
import {
  type IntervalMap,
  type ScoringEpisode,
  type Window,
  inActiveInterval,
  scoreGuests,
  scoreSponsors,
  scoreTopics,
  TREND_RULES,
} from "./scoring";

const DAY = 86_400_000;
const WEEK_START = Date.UTC(2026, 9, 4, 18, 30); // Mon 5 Oct 2026 00:00 IST
const w: Window = { weekStart: WEEK_START, weekEnd: WEEK_START + 7 * DAY - 1, lookbackDays: 30 };
const at = (daysBefore: number) => w.weekEnd - daysBefore * DAY;

const ep = (id: string, showId: string, daysBefore: number, extra: Partial<ScoringEpisode> = {}): ScoringEpisode => ({
  id,
  showId,
  publishedAt: at(daysBefore),
  views: 1000,
  guestIds: [],
  topicIds: [],
  ...extra,
});

const open = (from: number): IntervalMap[string] => [{ from, to: null }];
const allActive: IntervalMap = { a: open(0), b: open(0), c: open(0), d: open(0) };

describe("active-interval rule", () => {
  const map: IntervalMap = {
    old: [{ from: 0, to: w.weekStart - 10 * DAY }], // removed mid-window
    new: open(w.weekStart - 6 * DAY), // swapped in mid-window
  };
  it("excludes episodes published after a show was removed", () => {
    expect(inActiveInterval(ep("1", "old", 2), map)).toBe(false);
    expect(inActiveInterval(ep("2", "old", 20), map)).toBe(true);
  });
  it("excludes episodes published before a show was swapped in (no backfill)", () => {
    expect(inActiveInterval(ep("3", "new", 20), map)).toBe(false);
    expect(inActiveInterval(ep("4", "new", 2), map)).toBe(true);
  });
  it("a swap mid-window changes who counts as a media round", () => {
    const eps = [
      ep("e1", "old", 20, { guestIds: ["g"] }), // before removal, counts
      ep("e2", "new", 2, { guestIds: ["g"] }), // after swap-in, counts
      ep("e3", "new", 15, { guestIds: ["g"] }), // before swap-in, must NOT count
    ];
    const res = scoreGuests(eps, map, w);
    expect(res).toHaveLength(1);
    expect(res[0].episodeIds.sort()).toEqual(["e1", "e2"]);
    expect(res[0].showsCount).toBe(2);
  });
});

describe("guests", () => {
  it("trends on 2+ shows and requires a fresh appearance", () => {
    const fresh = [ep("1", "a", 2, { guestIds: ["g"] }), ep("2", "b", 10, { guestIds: ["g"] })];
    expect(scoreGuests(fresh, allActive, w)[0].mediaRound).toBe(true);
    const stale = [ep("1", "a", 12, { guestIds: ["g"] }), ep("2", "b", 14, { guestIds: ["g"] })];
    expect(scoreGuests(stale, allActive, w)).toHaveLength(0);
  });
  it("trends on above-median interview views alone", () => {
    // views are ranked among interview episodes, so the other episodes here have guests too
    const eps = Array.from({ length: 12 }, (_, i) => ep(`x${i}`, "a", 3 + i, { views: 1000, guestIds: [`filler${i}`] }));
    eps.push(ep("big", "b", 1, { views: 900000, guestIds: ["star"] }));
    const res = scoreGuests(eps, allActive, w);
    expect(res.map((r) => r.guestId)).toEqual(["star"]);
    expect(res[0].mediaRound).toBe(false);
  });
  it("ranks an interview against other interviews, not against guest-less news shows", () => {
    const news = Array.from({ length: 10 }, (_, i) => ep(`n${i}`, "c", 2 + i, { views: 500000 + i }));
    const interviews = Array.from({ length: 12 }, (_, i) => ep(`i${i}`, "a", 3 + i, { views: 1000, guestIds: [`filler${i}`] }));
    interviews.push(ep("top", "b", 1, { views: 20000, guestIds: ["star"] }));
    const res = scoreGuests([...news, ...interviews], allActive, w);
    expect(res.map((r) => r.guestId)).toEqual(["star"]);
    expect(res[0].viewsPercentile).toBeGreaterThanOrEqual(TREND_RULES.guestTopPercentile);
  });
  it("uses 0.6*shows + 0.4*views", () => {
    const eps = [
      ep("1", "a", 1, { guestIds: ["g"], views: 1000 }),
      ep("2", "b", 5, { guestIds: ["g"], views: 1000 }),
      ep("3", "c", 8, { guestIds: ["g"], views: 1000 }),
    ];
    const r = scoreGuests(eps, allActive, w)[0];
    expect(r.trendScore).toBeCloseTo(0.6 * 1 + 0.4 * r.viewsScore, 5);
  });
});

describe("topics", () => {
  it("needs the minimum shows and episodes, and one fresh episode", () => {
    const eps = [
      ep("1", "a", 1, { topicIds: ["t"] }),
      ep("2", "b", 9, { topicIds: ["t"] }),
      ep("4", "a", 2, { topicIds: ["u"] }), // two episodes but only one show
      ep("5", "a", 12, { topicIds: ["u"] }),
      ep("6", "a", 15, { topicIds: ["old"] }), // two shows and episodes, but nothing fresh this week
      ep("7", "b", 17, { topicIds: ["old"] }),
    ];
    const r = scoreTopics(eps, allActive, w);
    expect(TREND_RULES.topicMinShows).toBe(2);
    expect(r.trending.map((t) => t.topicId)).toEqual(["t"]);
    expect(r.emerging.map((t) => t.topicId)).toEqual(["u"]);
    expect(r.emerging[0].needs).toBe("1 more show");
  });
  it("marks rising when this week beats the 3-week average", () => {
    const eps = [
      ep("1", "a", 1, { topicIds: ["t"] }),
      ep("2", "b", 3, { topicIds: ["t"] }),
      ep("3", "a", 10, { topicIds: ["t"] }),
    ];
    const t = scoreTopics(eps, allActive, w).trending[0];
    expect(t.thisWeek).toBe(2);
    expect(t.prevAvg).toBeCloseTo(1 / 3, 5);
    expect(t.rising).toBe(true);
  });
});

describe("sponsors", () => {
  it("ranks by distinct shows then views and flags New vs Returning", () => {
    const rows = [
      { episodeId: "1", showId: "a", sponsorId: "s1", publishedAt: at(1), views: 100 },
      { episodeId: "2", showId: "b", sponsorId: "s1", publishedAt: at(2), views: 100 },
      { episodeId: "3", showId: "a", sponsorId: "s2", publishedAt: at(3), views: 9000 },
    ];
    const res = scoreSponsors(rows, { s1: w.weekStart - 40 * DAY, s2: w.weekStart + DAY }, allActive, w);
    expect(res.map((r) => r.sponsorId)).toEqual(["s1", "s2"]);
    expect(res[0].status).toBe("returning");
    expect(res[1].status).toBe("new");
  });
});
