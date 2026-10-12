import { describe, expect, it } from "vitest";
import { addDaysISO, formatCount, formatIST, formatWeekLabel, weekRangeIST, weekStartIST } from "./time";

describe("IST week math", () => {
  it("finds Monday for a Sunday-night IST instant (still the same week)", () => {
    // Sun 11 Oct 2026 23:30 IST = 18:00 UTC
    expect(weekStartIST("2026-10-11T18:00:00Z")).toBe("2026-10-05");
  });

  it("rolls to the next week right after midnight IST (UTC is still Sunday)", () => {
    // Mon 12 Oct 2026 00:10 IST = Sun 11 Oct 18:40 UTC
    expect(weekStartIST("2026-10-11T18:40:00Z")).toBe("2026-10-12");
  });

  it("week range runs Mon 00:00 to Sun 23:59:59.999 IST", () => {
    const r = weekRangeIST("2026-10-05");
    expect(r.start.toISOString()).toBe("2026-10-04T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-11T18:29:59.999Z");
    expect(r.weekEnd).toBe("2026-10-11");
  });

  it("crosses month and year edges", () => {
    expect(addDaysISO("2026-12-28", 7)).toBe("2027-01-04");
    expect(weekRangeIST("2026-12-28").weekEnd).toBe("2027-01-03");
    expect(weekStartIST("2027-01-01T10:00:00Z")).toBe("2026-12-28");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });

  it("labels", () => {
    expect(formatWeekLabel("2026-09-28")).toBe("28 Sep to 4 Oct");
    expect(formatWeekLabel("2026-10-05")).toBe("5 to 11 Oct");
    expect(formatIST("2026-10-12T01:32:00Z", "daytime")).toBe("12 Oct, 7:02 AM IST");
  });

  it("formats en-IN grouping", () => {
    expect(formatCount(212345)).toBe("2,12,345");
    expect(formatCount(1234567)).toBe("12,34,567");
    expect(formatCount(950)).toBe("950");
  });
});
