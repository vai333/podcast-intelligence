// Seeded deterministic RNG so the sample data is identical on every render and reload.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export function weightedPick<T>(r: Rng, xs: readonly T[], weight: (x: T) => number): T {
  const ws = xs.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  let t = r() * total;
  for (let i = 0; i < xs.length; i++) {
    t -= ws[i];
    if (t <= 0) return xs[i];
  }
  return xs[xs.length - 1];
}

/** Standard normal via Box-Muller. */
export function normal(r: Rng): number {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function idChars(r: Rng, n: number): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let s = "";
  for (let i = 0; i < n; i++) s += abc[Math.floor(r() * abc.length)];
  return s;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
