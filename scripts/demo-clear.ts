// npm run demo:clear          removes the demo episodes (and what only they referenced); keeps real data.
// npm run demo:clear -- --all removes EVERYTHING in the app's tables (shows, jobs, briefs, logs). Use it to start clean.
import { sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db/client";

async function main() {
  const all = process.argv.includes("--all");
  if (all) {
    await db().execute(
      sql`truncate table episode_sponsors, episode_topics, episode_guests, extractions, view_snapshots, episodes, guest_aliases, topic_aliases, sponsor_aliases, guests, topics, sponsors, shows, jobs, briefs, ingestion_log, cron_runs, api_usage, login_tokens, login_attempts, settings restart identity cascade`,
    );
    console.log("Everything removed (the YouTube search cache is kept, because searches cost API quota).");
  } else {
    const del = await db().execute(sql`delete from episodes where is_demo returning id`);
    await db().execute(sql`delete from guests g where not exists (select 1 from episode_guests x where x.guest_id = g.id)`);
    await db().execute(sql`delete from topics t where not exists (select 1 from episode_topics x where x.topic_id = t.id)`);
    await db().execute(sql`delete from sponsors s where not exists (select 1 from episode_sponsors x where x.sponsor_id = s.id)`);
    const [{ real }] = (await db().execute(sql`select count(*)::int as real from episodes`)).rows as { real: number }[];
    if (real === 0) {
      await db().execute(sql`delete from briefs`);
      console.log(`Removed ${del.rows.length} demo episodes and the demo briefs.`);
    } else {
      console.log(`Removed ${del.rows.length} demo episodes. Briefs were kept because real episodes exist (delete them by hand if they were demo-only).`);
    }
  }
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
