import { describe, expect, it } from "vitest";
import { Brief } from "../types";
import { composeBrief } from "./briefs";
import { LATEST_WEEK, generateWorld } from "./world";

describe("sample world", () => {
  const world = generateWorld("full");
  const brief = composeBrief(world, LATEST_WEEK);

  it("produces briefs that satisfy the DTO schema", () => {
    for (const w of world.briefWeeks) expect(() => Brief.parse(composeBrief(world, w))).not.toThrow();
  });

  it("contains the planted media round and the views-only guest", () => {
    const priya = brief.guests.find((g) => g.name === "Priya Raghavan");
    expect(priya?.mediaRound).toBe(true);
    expect(priya?.showsCount).toBe(3);
    expect(brief.guests.some((g) => g.name.startsWith("Arjun") && !g.mediaRound)).toBe(true);
  });

  it("has trending topics and a rising one", () => {
    expect(brief.topics.length).toBeGreaterThanOrEqual(3);
    expect(brief.topics.some((t) => t.rising)).toBe(true);
  });

  it("flags new vs returning sponsors", () => {
    expect(brief.sponsors.some((s) => s.status === "new")).toBe(true);
    expect(brief.sponsors.some((s) => s.status === "returning")).toBe(true);
  });

  it("has ugly cases: failed, skipped, metadata-only, and a lineup change", () => {
    expect(brief.coverage.skippedOrFailed).toBeGreaterThanOrEqual(3);
    expect(brief.coverage.analyzedMetadata).toBeGreaterThan(0);
    expect(composeBrief(world, "2026-09-14").lineupChanges.length).toBeGreaterThan(0);
  });

  it("never ingests episodes outside a show's active interval", () => {
    for (const e of world.episodes) {
      const s = world.shows.find((x) => x.id === e.showId)!;
      expect(s.intervals.some((i) => e.publishedAt >= i.from && (i.to === null || e.publishedAt <= i.to))).toBe(true);
    }
  });

  it("first-week and empty scenarios behave", () => {
    const fw = generateWorld("first-week");
    expect(fw.briefWeeks).toEqual([LATEST_WEEK]);
    expect(composeBrief(fw, LATEST_WEEK).isFirstWeek).toBe(true);
    expect(generateWorld("empty").episodes).toHaveLength(0);
  });

  it("prints a summary for eyeballing", () => {
    console.log(
      JSON.stringify({
        episodes: world.episodes.length,
        cov: brief.coverage,
        guests: brief.guests.map((g) => [g.name, g.showsCount, g.heat, g.mediaRound]),
        topics: brief.topics.map((t) => [t.label, t.showsCount, t.episodesCount, t.rising?.thisWeek ?? null]),
        emerging: brief.emergingTopics.map((t) => t.label),
        sponsors: brief.sponsors.map((s) => [s.name, s.showsCount, s.status]),
        lineup: brief.lineupChanges,
      }),
    );
  });
});
