// npm run import:extractions -- <file.json> [--model "name"]
// Stores analyses that were produced outside the Gemini pipeline (for example written by hand from each
// episode's title and description). The file maps an episode id to { guests, topics, sponsors, summary } in the
// same shape Gemini returns. Each entry is validated with the app's own schema and saved through the same
// function the pipeline uses, labelled "metadata only" (low confidence), and any queued Gemini job for that
// episode is retired so it is not analysed twice. Episodes that are not waiting for analysis are left alone.
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { ExtractionResult } from "@/lib/ai/schemas";
import { closeDb, db } from "@/lib/db/client";
import { episodes } from "@/lib/db/schema";
import { logEvent } from "@/lib/pipeline/log";
import { saveExtraction } from "@/lib/pipeline/extract";

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) throw new Error("Usage: npm run import:extractions -- <file.json> [--model name]");
  const mi = process.argv.indexOf("--model");
  const model = mi > 0 ? process.argv[mi + 1] : "manual (title and description)";
  const entries = Object.entries(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>);

  let saved = 0;
  const skipped: string[] = [];
  for (const [id, raw] of entries) {
    const [ep] = await db().select().from(episodes).where(eq(episodes.id, id));
    if (!ep) {
      skipped.push(`${id}: no such episode`);
      continue;
    }
    if (ep.status !== "discovered" && ep.status !== "failed") {
      skipped.push(`${ep.title.slice(0, 50)}: already ${ep.status}`);
      continue;
    }
    const data = ExtractionResult.parse(raw);
    await saveExtraction({ id: ep.id, publishedAt: ep.publishedAt }, data, { depth: "metadata", model, confidence: "low" });
    await db().execute(
      sql`update jobs set status = 'skipped', last_error = 'Analysed by hand', finished_at = now()
          where type = 'extract_episode' and status in ('pending', 'running') and payload->>'episodeId' = ${ep.id}`,
    );
    saved++;
  }
  await logEvent("info", "queue", `Imported ${saved} analyses written from titles and descriptions (${model}).`);
  console.log(`Saved ${saved} of ${entries.length} analyses.`);
  for (const s of skipped) console.log("  skipped:", s);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
