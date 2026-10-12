// Vercel Cron #1 (daily, 19:00 UTC = 00:30 IST). Queues the night's work, runs the first job, and starts the chain.
import { NextResponse } from "next/server";
import { cronAuthorized, rejected } from "@/lib/auth/cron";
import { kickWorker } from "@/lib/pipeline/kick";
import { errMsg, logEvent } from "@/lib/pipeline/log";
import { finishRun, processOne, startRun } from "@/lib/pipeline/worker";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return rejected();
  try {
    const started = await startRun("cron");
    const step = await processOne();
    if (step.more) kickWorker();
    else await finishRun();
    return NextResponse.json({ ok: true, started, step });
  } catch (e) {
    // Never let a failure escape a cron handler: log it and answer 200 with the reason.
    await logEvent("error", "queue", `Worker cron failed: ${errMsg(e)}`);
    return NextResponse.json({ ok: false, error: errMsg(e) });
  }
}
