// Normalisation applied in code after each extraction (spec 7.4). Pure functions.

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "shri", "smt", "sir", "prof", "professor", "mx"]);

function strip(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "Dr. Priya  Raghavan" -> "priya raghavan" */
export function normalizeGuestKey(name: string): string {
  const words = strip(name)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !HONORIFICS.has(w));
  return words.join(" ");
}

const COMPANY_SUFFIX = /\b(pvt|private|ltd|limited|inc|llc|corp|corporation|technologies|technology|tech|co|company)\b/g;

/** "Razorline Technologies Pvt. Ltd." / "razorline.com" -> "razorline" */
export function normalizeSponsorKey(name: string): string {
  return strip(name)
    .replace(/\.(com|in|io|ai|co|app|net|org)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(COMPANY_SUFFIX, " ")
    .replace(/\s+/g, "")
    .trim();
}

/** Lowercase, collapse spaces and singularise an obvious plural last word. */
export function normalizeTopicLabel(label: string): string {
  const words = strip(label)
    .replace(/[^a-z0-9\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "";
  const last = words[words.length - 1];
  words[words.length - 1] = singularize(last);
  return words.join(" ").slice(0, 60);
}

// Words that look plural but are not ("sales", "saas"), plus ones whose plural is the same word.
const KEEP = new Set(["sales", "news", "series", "species", "saas", "paas", "iaas", "devops", "analytics", "metrics", "operations", "ops", "mrr", "arr"]);

function singularize(w: string): string {
  if (w.length <= 3 || KEEP.has(w)) return w;
  if (/(ss|us|is|ics|ous|ness)$/.test(w)) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Cap evidence at N words (the model is asked for 25 but we never trust it). */
export function truncateWords(s: string, max: number): string {
  return s.trim().split(/\s+/).slice(0, max).join(" ");
}

/** Two guest keys that are probably the same person but must NOT be auto-merged (spec 7.4). */
export function nearMatch(aKey: string, bKey: string): boolean {
  if (aKey === bKey) return false;
  const a = aKey.split(" ");
  const b = bKey.split(" ");
  const lastSame = a[a.length - 1] === b[b.length - 1];
  const firstClose = a[0] === b[0] || a[0].startsWith(b[0]) || b[0].startsWith(a[0]);
  return a.length > 1 && b.length > 1 && lastSame && firstClose;
}
