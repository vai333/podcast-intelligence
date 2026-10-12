import { describe, expect, it } from "vitest";
import { composeBrief } from "@/lib/data/mock/briefs";
import { LATEST_WEEK, generateWorld } from "@/lib/data/mock/world";
import { validateNarrative } from "./narrative";

const world = generateWorld("full");
const brief = composeBrief(world, LATEST_WEEK);
const g = brief.guests[0];
const t = brief.topics[0];

describe("narrative validation", () => {
  it("replaces id tokens with real names and records refs", () => {
    const v = validateNarrative({ bullets: [`[guest:${g.id}] looks bookable and [topic:${t.id}] is hot.`], angles: [] }, brief);
    expect(v.summary).toHaveLength(1);
    expect(v.summary[0].text).toContain(g.name);
    expect(v.summary[0].text).toContain(`"${t.label}"`);
    expect(v.summary[0].refs.map((r) => r.id)).toEqual([g.id, t.id]);
  });
  it("drops a bullet that references an id that is not in the data", () => {
    const v = validateNarrative({ bullets: ["[guest:g_does-not-exist] is everywhere.", `[guest:${g.id}] is fine.`], angles: [] }, brief);
    expect(v.dropped).toBe(1);
    expect(v.summary).toHaveLength(1);
  });
  it("drops a bullet that uses the wrong kind for an id", () => {
    const v = validateNarrative({ bullets: [`[topic:${g.id}] is odd.`], angles: [] }, brief);
    expect(v.summary).toHaveLength(0);
  });
  it("drops a bullet with stray brackets", () => {
    const v = validateNarrative({ bullets: ["Something [maybe] happened."], angles: [] }, brief);
    expect(v.summary).toHaveLength(0);
  });
  it("keeps angles only for topics in the brief", () => {
    const v = validateNarrative({ bullets: [], angles: [{ topic_id: t.id, angle: "Do it differently this time." }, { topic_id: "t_nope", angle: "Ignore me please." }] }, brief);
    expect(Object.keys(v.angles)).toEqual([t.label]);
  });
});
