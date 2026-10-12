import { describe, expect, it } from "vitest";
import { composeBrief } from "@/lib/data/mock/briefs";
import { LATEST_WEEK, generateWorld } from "@/lib/data/mock/world";
import { briefHtml, briefSubject, briefText, esc } from "./brief-template";

const brief = composeBrief(generateWorld("full"), LATEST_WEEK);

describe("brief email", () => {
  it("has the expected subject, sections and button", () => {
    expect(briefSubject(brief)).toBe("Podcast Intelligence Brief: Week of Mon 5 Oct");
    const html = briefHtml(brief, "https://app.example.com");
    for (const s of ["What matters this week", "Trending guests", "Trending topics", "Active sponsors", "Open full dashboard", `/dashboard/briefs/${LATEST_WEEK}`]) expect(html).toContain(s);
  });
  it("escapes third-party text", () => {
    const evil = structuredClone(brief);
    evil.guests[0].name = `<script>alert("x")</script>`;
    evil.sponsors[0].mentions[0].evidence = `"><img src=x onerror=1>`;
    const html = briefHtml(evil, "https://app.example.com");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
  it("includes a plain-text alternative", () => {
    const t = briefText(brief, "https://app.example.com");
    expect(t).toContain("TRENDING GUESTS");
    expect(t).toContain("Open full dashboard: https://app.example.com/dashboard/briefs/");
  });
  it("esc handles quotes and ampersands", () => {
    expect(esc(`a & "b" <c>`)).toBe("a &amp; &quot;b&quot; &lt;c&gt;");
  });
});
