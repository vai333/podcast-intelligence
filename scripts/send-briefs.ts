// npm run briefs:send [-- <weekStart> ...]   emails every brief that has not been sent yet (oldest first), or the
// given weeks, to BRIEF_RECIPIENTS. Each brief is marked as sent, so running it twice never double-sends.
import { isNull } from "drizzle-orm";
import { closeDb, db } from "@/lib/db/client";
import { briefs } from "@/lib/db/schema";
import { sendBrief } from "@/lib/services/briefs";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const given = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  let weeks = given;
  if (!weeks.length) {
    const rows = await db().select({ w: briefs.weekStart }).from(briefs).where(isNull(briefs.sentAt)).orderBy(briefs.weekStart);
    weeks = rows.map((r) => r.w);
  }
  for (const w of weeks) {
    const r = await sendBrief(w);
    console.log(`${w}: ${r.ok ? "sent" : "NOT sent"} - ${r.message}`);
    await pause(1500);
  }
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
