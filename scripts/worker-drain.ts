// npm run worker:drain: runs the same nightly work in this process (no HTTP chain), printing each step.
// Handy for local testing: `npm run worker:drain` queues tonight's discovery and processes every job.
import { closeDb } from "@/lib/db/client";
import { drain, startRun } from "@/lib/pipeline/worker";

(async () => {
  const s = await startRun("manual");
  console.log("Queued:", s);
  const n = await drain({ onStep: (x) => !x.idle && console.log(`  ${x.job?.type} -> ${x.outcome}${x.error ? ` (${x.error.slice(0, 160)})` : ""}`) });
  console.log(`Processed ${n} job(s).`);
  await closeDb();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
