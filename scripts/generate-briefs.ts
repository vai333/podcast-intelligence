// npm run briefs:generate [-- <weekStart> ...]   builds the weekly briefs for the last five weeks (or the given
// IST Mondays, YYYY-MM-DD) from the analysed episodes, oldest first. Skips weeks that already have a brief.
// The first brief also refreshes view counts and asks Gemini to merge duplicate names; every brief gets its
// written summary from Gemini. Queued weekly_analysis jobs for those weeks are retired.
import { sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db/client";
import { runWeeklyAnalysis } from "@/lib/pipeline/weekly";
import { addDaysISO, weekStartIST } from "@/lib/time";

async function main() {
  const given = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const last = addDaysISO(weekStartIST(Date.now()), -7);
  const weeks = given.length ? [...given].sort() : Array.from({ length: 5 }, (_, i) => addDaysISO(last, -7 * (4 - i)));
  let first = true;
  for (const w of weeks) {
    const r = await runWeeklyAnalysis(w, { seeding: !first, narrative: "gemini" });
    console.log(`brief ${w}: ${r.created ? "created" : (r.reason ?? "skipped")}`);
    first = false;
    await db().execute(sql`update jobs set status = 'skipped', last_error = 'Brief generated directly', finished_at = now()
      where type = 'weekly_analysis' and status = 'pending' and payload->>'weekStart' = ${w}`);
  }
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
