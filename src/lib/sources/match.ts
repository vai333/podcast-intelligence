// Cross-platform matching: is this YouTube video the same episode as that Spotify episode,
// and does this YouTube channel belong with that Spotify show? Pure functions, easy to test.

const STOP = new Set(["the", "a", "an", "of", "and", "with", "ft", "feat", "featuring", "ep", "episode", "podcast", "full", "official"]);

/**
 * Lowercase, drop punctuation, "ep 12" markers and pipe-separated suffixes, and optionally the show name.
 * "How Zepto Won | Ep 12 | The Neon Show" -> "how zepto won".
 */
export function normalizeTitle(title: string, showName?: string): string {
  let t = title.toLowerCase();
  // keep only the part before the first separator that precedes the show name or an episode marker
  t = t.replace(/\b(?:ep|episode|e)\s*\.?\s*#?\d+\b/g, " ");
  t = t.replace(/#\d+/g, " ");
  if (showName) {
    const sn = showName.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (sn) t = t.replace(/[^a-z0-9| ]+/g, " ").split(sn).join(" ");
  }
  t = t.replace(/[|–—:]/g, " ").replace(/[^a-z0-9 ]+/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

const tokens = (s: string) => s.split(" ").filter((w) => w && !STOP.has(w));

/** Token-set Jaccard similarity, 0..1. */
export function tokenSimilarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface EpisodeLike {
  title: string;
  publishedAt: number; // ms
  durationSeconds: number | null;
}

const H72 = 72 * 3_600_000;

/** Spec 6.3: similarity >= 0.85, publish times within 72h, durations within 10% when both exist. */
export function isSameEpisode(a: EpisodeLike, b: EpisodeLike, showName?: string): boolean {
  if (Math.abs(a.publishedAt - b.publishedAt) > H72) return false;
  if (tokenSimilarity(normalizeTitle(a.title, showName), normalizeTitle(b.title, showName)) < 0.85) return false;
  if (a.durationSeconds && b.durationSeconds) {
    const diff = Math.abs(a.durationSeconds - b.durationSeconds) / Math.max(a.durationSeconds, b.durationSeconds);
    if (diff > 0.1) return false;
  }
  return true;
}

/** normalised title + day bucket (IST day), used for dedupe lookups. */
export function canonicalKey(title: string, publishedAt: number, showName?: string): string {
  const day = new Date(publishedAt + 330 * 60_000).toISOString().slice(0, 10);
  return `${normalizeTitle(title, showName)}|${day}`;
}

/** Similarity of two show/channel names, 0..1 (used to pair a YouTube channel with a Spotify show). */
export function nameSimilarity(a: string, b: string): number {
  const base = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const noThe = (x: string) => x.replace(/^the\s+/, "");
  const ba = base(a);
  const bb = base(b);
  if (!ba || !bb) return 0;
  if (ba === bb) return 1; // identical, article included: "The Ken" is not "Ken"
  const na = noThe(ba);
  const nb = noThe(bb);
  if (na === nb) return 0.92;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  // "Indian Silicon Valley by Jivraj" / "Founder Thesis with Akshay": the show name plus a host credit.
  if (long.startsWith(`${short} `) && /^(with|by|presents)\b/.test(long.slice(short.length + 1))) return 0.97;
  // Whole-word containment only ("indian dream" must not match "indian dreamer").
  if ((` ${long} `).includes(` ${short} `)) return 0.85;
  return tokenSimilarity(na, nb);
}
