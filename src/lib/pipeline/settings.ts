// Runtime settings stored in Neon (settings table, key/value). Defaults come from the spec.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { briefRecipients } from "@/lib/env";
import type { Settings } from "@/lib/data/types";

const DEFAULTS = {
  maxActiveShows: 10,
  minEpisodeMinutes: 15,
  maxEpisodeMinutes: 120,
  trendLookbackDays: 30,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db().select().from(settings);
  const kv = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (k: keyof typeof DEFAULTS) => (typeof kv[k] === "number" ? (kv[k] as number) : DEFAULTS[k]);
  return {
    maxActiveShows: num("maxActiveShows"),
    minEpisodeMinutes: num("minEpisodeMinutes"),
    maxEpisodeMinutes: num("maxEpisodeMinutes"),
    trendLookbackDays: num("trendLookbackDays"),
    adminEmail: briefRecipients().join(", "),
  };
}

export async function saveSettings(s: Omit<Settings, "adminEmail">): Promise<void> {
  const entries = Object.entries({
    maxActiveShows: s.maxActiveShows,
    minEpisodeMinutes: s.minEpisodeMinutes,
    maxEpisodeMinutes: s.maxEpisodeMinutes,
    trendLookbackDays: s.trendLookbackDays,
  });
  for (const [key, value] of entries) {
    await db().insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

export async function deleteSetting(key: string) {
  await db().delete(settings).where(eq(settings.key, key));
}
