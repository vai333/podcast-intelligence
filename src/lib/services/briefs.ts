// Reading frozen briefs and sending them by email.
import { desc, eq } from "drizzle-orm";
import { briefHeadline } from "@/lib/data/mock/briefs";
import { type ActionResult, Brief, type BriefListItem } from "@/lib/data/types";
import { db } from "@/lib/db/client";
import { briefs } from "@/lib/db/schema";
import { briefSubject, briefHtml, briefText } from "@/lib/email/brief-template";
import { emailEnabled, getMailer } from "@/lib/email/mailer";
import { briefRecipients, env } from "@/lib/env";
import { errMsg, logEvent } from "@/lib/pipeline/log";
import { previousWeekStart } from "@/lib/pipeline/weekly";

const Stored = Brief.omit({ prevWeek: true, nextWeek: true, isLatest: true, sentAt: true });
type Row = typeof briefs.$inferSelect;

function toBrief(row: Row, weeks: string[], sentAt: Date | null): Brief {
  const parsed = Stored.safeParse(row.payload);
  if (!parsed.success) throw new Error(`The stored brief for ${row.weekStart} could not be read (${parsed.error.issues[0]?.message ?? "unknown"}).`);
  const i = weeks.indexOf(row.weekStart);
  return {
    ...parsed.data,
    generatedAt: row.generatedAt.toISOString(),
    sentAt: sentAt ? sentAt.toISOString() : null,
    isLatest: i === weeks.length - 1,
    prevWeek: i > 0 ? weeks[i - 1] : null,
    nextWeek: i >= 0 && i < weeks.length - 1 ? weeks[i + 1] : null,
  };
}

export async function getBriefByWeek(weekStart: string): Promise<Brief | null> {
  const rows = await db().select().from(briefs).orderBy(briefs.weekStart);
  const row = rows.find((r) => r.weekStart === weekStart);
  return row ? toBrief(row, rows.map((r) => r.weekStart), row.sentAt) : null;
}

export async function getLatestBriefRow(): Promise<Brief | null> {
  const rows = await db().select().from(briefs).orderBy(briefs.weekStart);
  const row = rows[rows.length - 1];
  return row ? toBrief(row, rows.map((r) => r.weekStart), row.sentAt) : null;
}

export async function listBriefItems(): Promise<BriefListItem[]> {
  const rows = await db().select().from(briefs).orderBy(desc(briefs.weekStart));
  const weeks = [...rows].reverse().map((r) => r.weekStart);
  return rows.map((r) => {
    const b = toBrief(r, weeks, r.sentAt);
    return {
      weekStart: b.weekStart,
      weekEnd: b.weekEnd,
      generatedAt: b.generatedAt,
      sentAt: b.sentAt,
      coverage: b.coverage,
      guestsCount: b.guests.length,
      topicsCount: b.topics.length,
      sponsorsCount: b.sponsors.length,
      headline: briefHeadline(b),
    };
  });
}

/** Send one brief. Idempotent unless `resend` is true. A failed send leaves sent_at null so it can be retried. */
export async function sendBrief(weekStart: string, opts: { resend?: boolean } = {}): Promise<ActionResult> {
  const rows = await db().select().from(briefs).orderBy(briefs.weekStart);
  const row = rows.find((r) => r.weekStart === weekStart);
  if (!row) return { ok: false, message: "There is no brief to send yet." };
  if (row.sentAt && !opts.resend) return { ok: false, message: "This brief was already sent. Choose Resend to send it again." };
  if (!emailEnabled()) return { ok: false, message: "Email is not set up yet. Add RESEND_API_KEY and EMAIL_FROM, then try again." };

  const brief = toBrief(row, rows.map((r) => r.weekStart), row.sentAt);
  try {
    const { id } = await getMailer().send({
      to: briefRecipients(),
      subject: briefSubject(brief),
      html: briefHtml(brief, env().APP_URL),
      text: briefText(brief, env().APP_URL),
    });
    await db()
      .update(briefs)
      .set({ sentAt: row.sentAt ?? new Date(), emailMessageId: id })
      .where(eq(briefs.id, row.id));
    await logEvent("info", "email", `Weekly brief for ${weekStart} sent to ${briefRecipients().length} recipient(s).`, { label: `Brief ${weekStart}` });
    return { ok: true, message: opts.resend ? "Brief resent." : "Brief sent." };
  } catch (e) {
    await logEvent("error", "email", `Sending the brief failed: ${errMsg(e)}`, { label: `Brief ${weekStart}` });
    return { ok: false, message: `Sending failed: ${errMsg(e)}. The brief stays unsent so you can retry.` };
  }
}

/** The Monday mailer cron: send the just-ended week's brief once, if it is ready. */
export async function runMailer(): Promise<{ sent: boolean; reason?: string }> {
  const weekStart = previousWeekStart();
  const [row] = await db().select().from(briefs).where(eq(briefs.weekStart, weekStart));
  if (!row) return { sent: false, reason: "The brief is not ready yet. Use Send brief now on the System page once it is." };
  if (row.sentAt) return { sent: false, reason: "Already sent." };
  const r = await sendBrief(weekStart);
  return { sent: r.ok, reason: r.ok ? undefined : r.message };
}

