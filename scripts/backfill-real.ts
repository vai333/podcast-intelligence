// npm run backfill:real          replaces the invented demo history with the REAL episodes of the last five weeks.
//
// One-off bootstrap for a database that was seeded with `npm run seed:demo`:
//   1. removes the demo episodes, anything only they referenced, the demo briefs and the demo lineup history;
//   2. moves every active show's tracking start back five weeks (the only time the no-backfill rule is bypassed);
//   3. runs discovery for each show, so the real episodes are stored with exact YouTube video links;
//   4. queues extraction oldest-first, then one weekly_analysis per week (they wait for extraction to finish).
// Then run `npm run worker:drain` (or let the nightly cron do it) to analyse the episodes and write the briefs.
import { and, inArray, isNull, sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db/client";
import { ingestionLog, shows } from "@/lib/db/schema";
import { discoverShow } from "@/lib/pipeline/discover";
import { enqueue } from "@/lib/pipeline/queue";
import { addDaysISO, startOfDayIST, weekStartIST } from "@/lib/time";

const WEEKS = 5;

async function main() {
  const lastWeek = addDaysISO(weekStartIST(Date.now()), -7);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDaysISO(lastWeek, -7 * (WEEKS - 1 - i)));
  const windowStart = startOfDayIST(weeks[0]);
  console.log(`Window: ${weeks[0]} to ${lastWeek} (${WEEKS} weekly briefs). Tracking starts ${windowStart.toISOString()}.`);

  const busy = (await db().execute(sql`select count(*)::int as n from jobs where status in ('pending','running')`)).rows[0] as { n: number };
  if (busy.n > 0) throw new Error(`${busy.n} job(s) are pending or running. Let the queue finish first.`);

  /* 1. remove the demo data */
  const demo = (await db().execute(sql`select id from episodes where is_demo`)).rows as { id: string }[];
  const demoIds = demo.map((d) => d.id);
  if (demoIds.length) await db().delete(ingestionLog).where(inArray(ingestionLog.refId, demoIds));
  await db().execute(sql`delete from ingestion_log where message like 'Demo history seeded%'`);
  await db().execute(sql`delete from episodes where is_demo`);
  await db().execute(sql`delete from guests g where not exists (select 1 from episode_guests x where x.guest_id = g.id)`);
  await db().execute(sql`delete from topics t where not exists (select 1 from episode_topics x where x.topic_id = t.id)`);
  await db().execute(sql`delete from sponsors s where not exists (select 1 from episode_sponsors x where x.sponsor_id = s.id)`);
  const delBriefs = await db().execute(sql`delete from briefs returning id`);
  // Past lineup intervals that no remaining episode belongs to were part of the demo history.
  const delShows = await db().execute(
    sql`delete from shows s where s.active_to is not null and not exists (select 1 from episodes e where e.show_id = s.id) returning id`,
  );
  console.log(`Removed ${demoIds.length} demo episodes, ${delBriefs.rows.length} demo briefs and ${delShows.rows.length} demo lineup intervals.`);

  /* 2. track the active shows from the start of the window */
  await db()
    .update(shows)
    .set({ activeFrom: windowStart, lastSeenPublishedAt: windowStart, lastDiscoveredAt: null, lastError: null, failureCount: 0 })
    .where(isNull(shows.activeTo));
  const active = await db().select().from(shows).where(and(isNull(shows.activeTo)));
  console.log(`${active.length} active shows now tracked from ${windowStart.toISOString().slice(0, 10)}.`);

  /* 3. discover the real episodes */
  let inserted = 0;
  let ignored = 0;
  for (const s of active) {
    const r = await discoverShow(s.id);
    inserted += r.inserted;
    ignored += r.ignored;
    console.log(`  ${s.name.padEnd(30)} found ${String(r.found).padStart(2)}  new ${String(r.inserted).padStart(2)}  clips ignored ${r.ignored}`);
  }
  console.log(`Stored ${inserted} new real episodes (${ignored} shorts/clips ignored).`);

  /* 4. extraction oldest-first, then the weekly briefs (they wait until extraction is done) */
  await db().execute(sql`
    update jobs set created_at = e.published_at
    from episodes e
    where jobs.type = 'extract_episode' and jobs.status = 'pending' and (jobs.payload->>'episodeId')::uuid = e.id`);
  for (const w of weeks) await enqueue("weekly_analysis", { weekStart: w });
  const [{ n }] = (await db().execute(sql`select count(*)::int as n from jobs where status = 'pending' and type = 'extract_episode'`)).rows as { n: number }[];
  console.log(`Queued ${n} extraction job(s) and ${weeks.length} weekly brief job(s). Next: npm run worker:drain`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
