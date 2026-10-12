// Username + password sign-in. The credentials live in environment variables (ADMIN_USERNAME / ADMIN_PASSWORD),
// never in source. Comparison is constant-time and failed attempts are rate limited.
import { createHash, timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Constant-time comparison (hashing first makes both sides the same length). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** Only same-site dashboard paths are allowed as a post-login destination. */
export const safeNext = (n: string | null | undefined) => (n && /^\/dashboard(\/[\w\-./]*)?$/.test(n) ? n : "/dashboard");

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

export async function tooManyFailures(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [{ n }] = (await db().execute(sql`select count(*)::int as n from login_attempts where key_hash = ${sha256(`login:${ip}`)} and at > ${since}`)).rows as { n: number }[];
  return n >= MAX_FAILURES;
}

export async function recordFailure(ip: string): Promise<void> {
  await db().insert(loginAttempts).values({ keyHash: sha256(`login:${ip}`) });
}

export function checkCredentials(username: string, password: string): boolean {
  const u = safeEqual(username.trim().toLowerCase(), env().ADMIN_USERNAME.toLowerCase());
  const p = safeEqual(password, env().ADMIN_PASSWORD);
  return u && p;
}
