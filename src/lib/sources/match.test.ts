import { describe, expect, it } from "vitest";
import { canonicalKey, isSameEpisode, nameSimilarity, normalizeTitle, tokenSimilarity } from "./match";
import { parseIsoDuration } from "./youtube";

describe("normalizeTitle", () => {
  it("removes punctuation, episode markers and the show name", () => {
    expect(normalizeTitle("How Zepto Won | Ep 12 | The Neon Show", "The Neon Show")).toBe("how zepto won");
    expect(normalizeTitle("#45: Seed rounds, explained!", "SeedToScale")).toBe("seed rounds explained");
  });
});

describe("isSameEpisode", () => {
  const base = { title: "How Zepto Won | Ep 12 | The Neon Show", publishedAt: Date.UTC(2026, 9, 5, 8), durationSeconds: 3600 };
  it("matches the same episode across platforms", () => {
    const sp = { title: "How Zepto Won", publishedAt: Date.UTC(2026, 9, 5, 0), durationSeconds: 3540 };
    expect(isSameEpisode(base, sp, "The Neon Show")).toBe(true);
  });
  it("rejects when titles differ", () => {
    expect(isSameEpisode(base, { ...base, title: "Why Swiggy lost money" }, "The Neon Show")).toBe(false);
  });
  it("rejects when publish times are more than 72h apart", () => {
    expect(isSameEpisode(base, { ...base, publishedAt: base.publishedAt + 80 * 3_600_000 }, "The Neon Show")).toBe(false);
  });
  it("rejects when durations differ by more than 10%", () => {
    expect(isSameEpisode(base, { ...base, durationSeconds: 2400 }, "The Neon Show")).toBe(false);
  });
  it("still matches when one duration is missing", () => {
    expect(isSameEpisode(base, { ...base, durationSeconds: null }, "The Neon Show")).toBe(true);
  });
});

describe("misc", () => {
  it("similarity bounds", () => {
    expect(tokenSimilarity("a b c", "a b c")).toBe(1);
    expect(tokenSimilarity("alpha beta", "gamma delta")).toBe(0);
  });
  it("canonical key uses the IST day", () => {
    // 20:00 UTC on 5 Oct is already 6 Oct in IST
    expect(canonicalKey("Hello World", Date.UTC(2026, 9, 5, 20))).toBe("hello world|2026-10-06");
  });
  it("pairs channel and show names", () => {
    expect(nameSimilarity("The Neon Show", "Neon Show")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("The Neon Show", "Some Other Podcast")).toBeLessThan(0.5);
  });
  it("parses ISO durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45M")).toBe(2700);
    expect(parseIsoDuration("PT59S")).toBe(59);
  });
});

describe("show name matching", () => {
  it("an exact title beats an article-less look-alike", () => {
    expect(nameSimilarity("The Ken", "The Ken")).toBe(1);
    expect(nameSimilarity("The Ken", "Ken")).toBeLessThan(1);
  });
  it("does not match a longer different name", () => {
    expect(nameSimilarity("The Indian Dream", "The Indian Dreamer")).toBeLessThan(0.6);
  });
  it("accepts a host credit suffix", () => {
    expect(nameSimilarity("Founder Thesis", "Founder Thesis with Akshay Datt")).toBeGreaterThanOrEqual(0.95);
  });
});
