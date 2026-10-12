// The self-chaining link. It answers immediately ("accepted") and works after the response, so the caller never
// holds a connection open. Each link processes jobs for about three minutes, then starts a fresh link if work remains.
import { NextResponse, after } from "next/server";
import { cronAuthorized, rejected } from "@/lib/auth/cron";
import { kickNow } from "@/lib/pipeline/kick";
import { errMsg, logEvent } from "@/lib/pipeline/log";
import { RUN_BUDGET_MS, runFor } from "@/lib/pipeline/worker";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_CHAIN = 1000;

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return rejected();
  const depth = Number(req.headers.get("x-chain-depth") ?? 0) || 0;
  after(async () => {
    try {
      const r = await runFor(RUN_BUDGET_MS);
      if (r.more && depth < MAX_CHAIN) await kickNow(depth);
    } catch (e) {
      await logEvent("error", "queue", `Worker step failed: ${errMsg(e)}`);
    }
  });
  return NextResponse.json({ ok: true, accepted: true, depth }, { status: 202 });
}
