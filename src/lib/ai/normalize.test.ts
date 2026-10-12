import { describe, expect, it } from "vitest";
import { nearMatch, normalizeGuestKey, normalizeSponsorKey, normalizeTopicLabel, truncateWords } from "./normalize";

describe("normalize", () => {
  it("guest keys drop honorifics, punctuation and diacritics", () => {
    expect(normalizeGuestKey("Dr. Priya  Raghavan")).toBe("priya raghavan");
    expect(normalizeGuestKey("Shri José O'Neil")).toBe("jose o neil");
  });
  it("sponsor keys drop company suffixes and domains", () => {
    expect(normalizeSponsorKey("Razorline Technologies Pvt. Ltd.")).toBe("razorline");
    expect(normalizeSponsorKey("razorline.com")).toBe("razorline");
    expect(normalizeSponsorKey("Flow Desk")).toBe("flowdesk");
  });
  it("topic labels are lowercase and singular", () => {
    expect(normalizeTopicLabel("D2C Brands")).toBe("d2c brand");
    expect(normalizeTopicLabel("Seed  Funding Rounds")).toBe("seed funding round");
    expect(normalizeTopicLabel("Unit Economics")).toBe("unit economics");
    expect(normalizeTopicLabel("quick commerce")).toBe("quick commerce");
    expect(normalizeTopicLabel("Founder-led Sales")).toBe("founder-led sales");
    expect(normalizeTopicLabel("b2b SaaS")).toBe("b2b saas");
    expect(normalizeTopicLabel("Customer Support Queries")).toBe("customer support query");
  });
  it("truncates evidence to 25 words", () => {
    expect(truncateWords(Array(40).fill("w").join(" "), 25).split(" ")).toHaveLength(25);
  });
  it("near matches are flagged but identical keys are not", () => {
    expect(nearMatch("priya raghavan", "priya r raghavan")).toBe(true);
    expect(nearMatch("priya raghavan", "priya raghavan")).toBe(false);
    expect(nearMatch("priya raghavan", "arjun mehta")).toBe(false);
  });
});
