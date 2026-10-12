// Vercel Cron #1 (daily, 19:00 UTC = 00:30 IST). Queues the night's work and starts processing it after the
// response is sent; if the queue is not drained within the time budget, a fresh link continues the chain.
import { NextResponse, after } from "next/server";
import { cronAuthorized, rejected } from "@/lib/auth/cron";
import { kickNow } from "@/lib/pipeline/kick";
import { errMsg, logEvent } from "@/lib/pipeline/log";
import { RUN_BUDGET_MS, runFor, startRun } from "@/lib/pipeline/worker";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return rejected();
  try {
    const started = await startRun("cron");
    after(async () => {
      try {
        const r = await runFor(RUN_BUDGET_MS);
        if (r.more) await kickNow();
      } catch (e) {
        await logEvent("error", "queue", `Worker run failed: ${errMsg(e)}`);
      }
    });
    return NextResponse.json({ ok: true, started });
  } catch (e) {
    // Never let a failure escape a cron handler: log it and answer 200 with the reason.
    await logEvent("error", "queue", `Worker cron failed: ${errMsg(e)}`);
    return NextResponse.json({ ok: false, error: errMsg(e) });
  }
}
