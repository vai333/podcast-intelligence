import { describe, expect, it } from "vitest";
import { SHAPES, buildShapes } from "./shapes";

describe("home story shapes", () => {
  const shapes = buildShapes(3000);
  it("have the same point count so they can morph", () => {
    for (const s of SHAPES) {
      expect(shapes[s].pos.length).toBe(9000);
      expect(shapes[s].nrm.length).toBe(9000);
    }
  });
  it("contain only finite coordinates within a sensible box", () => {
    for (const s of SHAPES)
      for (const v of shapes[s].pos) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(2.6);
      }
  });
  it("carry normals whose length is an albedo (0..1, or 1.25 / 1.5 marking drawn lines)", () => {
    for (const s of SHAPES) {
      const n = shapes[s].nrm;
      for (let i = 0; i < n.length; i += 3) {
        const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
        expect(Number.isFinite(l)).toBe(true);
        expect(l).toBeGreaterThan(0.05);
        expect(l).toBeLessThanOrEqual(1.5001);
      }
    }
  });
  it("are deterministic and different from each other", () => {
    expect(buildShapes(3000).guest.pos[100]).toBe(shapes.guest.pos[100]);
    expect(shapes.guest.pos[100]).not.toBe(shapes.topics.pos[100]);
  });
});
