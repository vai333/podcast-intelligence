import { describe, expect, it } from "vitest";
import { parseRetryAfter } from "./gemini";

describe("parseRetryAfter", () => {
  it("reads seconds", () => expect(parseRetryAfter("Please retry in 55.527836022s.")).toBe(58));
  it("reads hours and minutes (daily quota)", () => expect(parseRetryAfter("Please retry in 18h44m4.67s.")).toBe(18 * 3600 + 44 * 60 + 5 + 2));
  it("reads a RetryInfo delay", () => expect(parseRetryAfter('{"retryDelay":"30s"}')).toBe(32));
  it("defaults to a minute", () => expect(parseRetryAfter("quota exceeded")).toBe(60));
});
