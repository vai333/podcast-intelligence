// Grounded narrative (spec 8.4). Gemini sees the computed JSON only (never transcripts) and may name
// guests, topics and sponsors only through [guest:ID] / [topic:ID] / [sponsor:ID] tokens. We swap tokens
// for names ourselves, so any bullet that mentions something not in the data is dropped.
import { generateJson } from "@/lib/ai/gemini";
import { NARRATIVE_INSTRUCTIONS } from "@/lib/ai/prompts";
import { Narrative, narrativeResponseSchema } from "@/lib/ai/schemas";
import type { Brief, SummaryBullet } from "@/lib/data/types";

export function narrativeInput(b: Brief) {
  return {
    week: `${b.weekStart} to ${b.weekEnd}`,
    firstWeekOfTracking: b.isFirstWeek,
    coverage: b.coverage,
    guests: b.guests.map((g) => ({
      id: g.id,
      name: g.name,
      company: g.company,
      shows: g.showsCount,
      daysBetweenFirstAndLastAppearance: g.spanDays,
      mediaRound: g.mediaRound,
      viewsPercentile: g.viewsPercentile,
    })),
    topics: b.topics.map((t) => ({
      id: t.id,
      label: t.label,
      shows: t.showsCount,
      episodes30d: t.episodesCount,
      rising: t.rising ? { thisWeek: t.rising.thisWeek, previousWeeklyAverage: t.rising.prevAvg } : null,
      coveredBy: t.shows,
    })),
    sponsors: b.sponsors.map((s) => ({ id: s.id, name: s.name, status: b.isFirstWeek ? "unknown" : s.status, shows: s.showsCount, placements: s.placements.map((p) => p.replace(/_/g, "-")) })),
  };
}

const TOKEN = /\[(guest|topic|sponsor):([^\]\s]+)\]/g;

export interface ValidatedNarrative {
  summary: SummaryBullet[];
  angles: Record<string, string>;
  dropped: number;
}

/** Pure: swaps tokens for names, drops any bullet that references an unknown id or leaves stray brackets. */
export function validateNarrative(n: Narrative, b: Brief): ValidatedNarrative {
  const names = new Map<string, { kind: "guest" | "topic" | "sponsor"; label: string }>();
  for (const g of b.guests) names.set(g.id, { kind: "guest", label: g.name });
  for (const t of b.topics) names.set(t.id, { kind: "topic", label: t.label });
  for (const s of b.sponsors) names.set(s.id, { kind: "sponsor", label: s.name });

  const summary: SummaryBullet[] = [];
  let dropped = 0;
  for (const bullet of n.bullets) {
    let ok = true;
    const refs: SummaryBullet["refs"] = [];
    const text = bullet.replace(TOKEN, (_m, kind: string, id: string) => {
      const hit = names.get(id);
      if (!hit || hit.kind !== kind) {
        ok = false;
        return "";
      }
      if (!refs.some((r) => r.id === id)) refs.push({ kind: hit.kind, id, label: hit.label });
      return kind === "topic" ? `"${hit.label}"` : hit.label;
    });
    if (!ok || /[[\]]/.test(text)) {
      dropped++;
      continue;
    }
    summary.push({ text: text.trim(), refs });
  }

  const angles: Record<string, string> = {};
  for (const a of n.angles) {
    const t = b.topics.find((x) => x.id === a.topic_id);
    if (t) angles[t.label] = a.angle.trim();
  }
  return { summary: summary.slice(0, 5), angles, dropped };
}

export async function generateNarrative(b: Brief): Promise<ValidatedNarrative | null> {
  if (!b.guests.length && !b.topics.length && !b.sponsors.length) return null;
  const res = await generateJson({
    parts: [{ text: `${NARRATIVE_INSTRUCTIONS}\n\nDATA:\n${JSON.stringify(narrativeInput(b))}` }],
    responseSchema: narrativeResponseSchema,
    schema: Narrative,
  });
  const v = validateNarrative(res.data, b);
  return v.summary.length ? v : null;
}
