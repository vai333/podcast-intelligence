// Starts (or continues) the self-chaining worker: POST /api/worker/next.
// If the chain ever breaks, the admin "Run worker now" button or tomorrow's cron restarts it.
import { after } from "next/server";
import { env } from "@/lib/env";

/** Calls the next link and waits for its quick "accepted" answer. Safe to await: the link replies before doing its work. */
export async function kickNow(depth = 0): Promise<void> {
  const url = `${env().APP_URL.replace(/\/$/, "")}/api/worker/next`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    await fetch(url, { method: "POST", headers: { authorization: `Bearer ${env().CRON_SECRET}`, "x-chain-depth": String(depth + 1) }, signal: ctrl.signal });
  } catch {
    /* unreachable: the next cron run (or Run worker now) resumes pending jobs */
  } finally {
    clearTimeout(t);
  }
}

/** Start the chain after the current response has been sent. */
export function kickWorker(depth = 0): void {
  try {
    after(() => kickNow(depth));
  } catch {
    void kickNow(depth); // outside a request (scripts): best effort
  }
}
