// Estimated API usage per day (YouTube quota units, Gemini episodes/tokens) kept in Neon.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiUsage } from "@/lib/db/schema";
import { isoDateIST } from "@/lib/time";

/** YouTube quota resets at midnight Pacific; UTC-8 is close enough for an estimate. */
export const youtubeDay = (now = Date.now()) => new Date(now - 8 * 3_600_000).toISOString().slice(0, 10);
export const istDay = (now = Date.now()) => isoDateIST(now);

export async function addUsage(day: string, key: string, amount: number): Promise<void> {
  if (!amount) return;
  await db()
    .insert(apiUsage)
    .values({ day, key, amount })
    .onConflictDoUpdate({ target: [apiUsage.day, apiUsage.key], set: { amount: sql`${apiUsage.amount} + ${amount}` } });
}

export async function getUsage(day: string, key: string): Promise<number> {
  const [row] = await db()
    .select({ amount: apiUsage.amount })
    .from(apiUsage)
    .where(and(eq(apiUsage.day, day), eq(apiUsage.key, key)));
  return row?.amount ?? 0;
}

export async function weeklyTokens(): Promise<number> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const r = await db().execute(sql`select coalesce(sum(amount),0)::int as n from api_usage where key = 'gemini_tokens' and day >= ${since}`);
  return Number((r.rows[0] as { n: number }).n);
}
