// Starts (or continues) the self-chaining worker: POST /api/worker/next after the current response is sent.
// If the chain ever breaks, the admin "Run worker now" button or tomorrow's cron restarts it.
import { after } from "next/server";
import { env } from "@/lib/env";

export function kickWorker(depth = 0): void {
  const url = `${env().APP_URL.replace(/\/$/, "")}/api/worker/next`;
  const send = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000); // the next link runs on its own; we only need to start it
    try {
      await fetch(url, { method: "POST", headers: { authorization: `Bearer ${env().CRON_SECRET}`, "x-chain-depth": String(depth + 1) }, signal: ctrl.signal });
    } catch {
      /* aborted or unreachable: the next cron run resumes pending jobs */
    } finally {
      clearTimeout(t);
    }
  };
  try {
    after(send);
  } catch {
    void send(); // outside a request (scripts): best effort
  }
}
