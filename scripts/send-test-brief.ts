// npm run send:test: emails the latest brief to BRIEF_RECIPIENTS without marking it as sent.
import { closeDb } from "@/lib/db/client";
import { briefHtml, briefSubject, briefText } from "@/lib/email/brief-template";
import { getMailer } from "@/lib/email/mailer";
import { briefRecipients, env } from "@/lib/env";
import { getLatestBriefRow } from "@/lib/services/briefs";

(async () => {
  const b = await getLatestBriefRow();
  if (!b) throw new Error("No brief exists yet.");
  const to = briefRecipients();
  const { id } = await getMailer().send({ to, subject: `[Test] ${briefSubject(b)}`, html: briefHtml(b, env().APP_URL), text: briefText(b, env().APP_URL) });
  console.log(`Sent to ${to.join(", ")} (Resend id ${id})`);
  await closeDb();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
