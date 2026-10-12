// Vercel Cron #2 (Mondays 01:00 UTC = 06:30 IST, so it fires between about 06:30 and 07:29 IST).
// Sends the just-finished brief once. If the brief is not ready it exits cleanly; the dashboard has "Send brief now".
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cronAuthorized, rejected } from "@/lib/auth/cron";
import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";
import { errMsg } from "@/lib/pipeline/log";
import { runMailer } from "@/lib/services/briefs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return rejected();
  const [run] = await db().insert(cronRuns).values({ name: "mailer" }).returning({ id: cronRuns.id });
  try {
    const r = await runMailer();
    await db()
      .update(cronRuns)
      .set({ finishedAt: new Date(), outcome: r.sent || r.reason === "Already sent." ? "ok" : "partial", summary: r })
      .where(eq(cronRuns.id, run.id));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    await db().update(cronRuns).set({ finishedAt: new Date(), outcome: "failed", summary: { reason: errMsg(e) } }).where(eq(cronRuns.id, run.id));
    return NextResponse.json({ ok: false, error: errMsg(e) });
  }
}
