// The self-chaining link: claim one job, run it, then start the next link if more work is ready.
import { NextResponse } from "next/server";
import { cronAuthorized, rejected } from "@/lib/auth/cron";
import { kickWorker } from "@/lib/pipeline/kick";
import { errMsg, logEvent } from "@/lib/pipeline/log";
import { finishRun, processOne } from "@/lib/pipeline/worker";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_CHAIN = 1000;

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return rejected();
  const depth = Number(req.headers.get("x-chain-depth") ?? 0) || 0;
  try {
    const step = await processOne();
    if (step.more && depth < MAX_CHAIN) kickWorker(depth);
    else if (!step.more) await finishRun();
    return NextResponse.json({ ok: true, step, depth });
  } catch (e) {
    await logEvent("error", "queue", `Worker step failed: ${errMsg(e)}`);
    return NextResponse.json({ ok: false, error: errMsg(e) });
  }
}
