// Weekly analysis (spec section 8). Idempotent: if a brief for the week exists, nothing happens.
import { eq } from "drizzle-orm";
import { composeBrief } from "@/lib/data/mock/briefs";
import { loadWorld } from "@/lib/data/db/world";
import type { Brief } from "@/lib/data/types";
import { db } from "@/lib/db/client";
import { briefs } from "@/lib/db/schema";
import { addDaysISO, startOfDayIST, weekStartIST } from "@/lib/time";
import { consolidate } from "./consolidate";
import { errMsg, logEvent } from "./log";
import { generateNarrative } from "./narrative";
import { refreshViews } from "./views";

export interface WeeklyOptions {
  /** "gemini" (default) writes the narrative with Gemini; "template" uses the built-in wording. */
  narrative?: "gemini" | "template";
  /** Skip the view refresh and consolidation (used when seeding demo history). */
  seeding?: boolean;
  /** Counter-programming wording used only when the AI does not provide one (demo seeding). */
  fallbackAngles?: Record<string, string>;
  /** Stamp the brief as generated at this time (demo seeding). */
  generatedAt?: Date;
}

/** The IST Monday of the week that just ended, as of `now`. */
export const previousWeekStart = (now = Date.now()) => addDaysISO(weekStartIST(now), -7);

export async function runWeeklyAnalysis(weekStart: string, opts: WeeklyOptions = {}): Promise<{ created: boolean; reason?: string }> {
  const [existing] = await db().select({ id: briefs.id }).from(briefs).where(eq(briefs.weekStart, weekStart));
  if (existing) return { created: false, reason: "A brief for this week already exists." };

  if (!opts.seeding) {
    const v = await refreshViews();
    await logEvent("info", "queue", `View refresh: ${v.updated} of ${v.checked} episodes updated.`);
    const c = await consolidate();
    if (c.guestsMerged + c.topicsMerged + c.sponsorsMerged) {
      await logEvent("info", "queue", `Consolidation merged ${c.guestsMerged} guests, ${c.topicsMerged} topics, ${c.sponsorsMerged} sponsors.`);
    }
  }

  const world = await loadWorld();
  const weekStartMs = startOfDayIST(weekStart).getTime();
  const firstWeek = !world.episodes.some((e) => e.publishedAt < weekStartMs);
  // The world only knows about briefs that exist; make this week's neighbours resolvable.
  world.briefWeeks = [...new Set([...world.briefWeeks, weekStart])].sort();

  const generatedAt = opts.generatedAt ?? new Date();
  const baseAngles = opts.fallbackAngles ?? {};
  let brief = composeBrief(world, weekStart, { firstWeek, generatedAt, angles: baseAngles });
  let narrativeText = brief.summary.map((s) => s.text).join("\n");

  if ((opts.narrative ?? "gemini") === "gemini") {
    try {
      const n = await generateNarrative(brief);
      if (n) {
        brief = composeBrief(world, weekStart, { firstWeek, generatedAt, summary: n.summary, angles: { ...baseAngles, ...n.angles } });
        narrativeText = n.summary.map((s) => s.text).join("\n");
        if (n.dropped) await logEvent("warn", "api", `Narrative: dropped ${n.dropped} bullet(s) that referenced something not in the data.`);
      }
    } catch (e) {
      await logEvent("warn", "api", `Narrative generation failed, used built-in wording: ${errMsg(e)}`);
    }
  }

  const inserted = await db()
    .insert(briefs)
    .values({
      weekStart,
      weekEnd: brief.weekEnd,
      payload: stripNav(brief) as never,
      narrative: narrativeText,
      coverage: brief.coverage,
      generatedAt,
    })
    .onConflictDoNothing()
    .returning({ id: briefs.id });
  if (!inserted.length) return { created: false, reason: "Another run created it first." };
  await logEvent("info", "queue", `Weekly brief created for week of ${weekStart}.`, { label: `Brief ${weekStart}` });
  return { created: true };
}

/** Navigation and send state are computed when the brief is read, never frozen. */
function stripNav(b: Brief) {
  const { prevWeek: _p, nextWeek: _n, isLatest: _l, sentAt: _s, ...rest } = b;
  void _p;
  void _n;
  void _l;
  void _s;
  return rest;
}
