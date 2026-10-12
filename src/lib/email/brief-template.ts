// The Monday email: inline-styled, table-based HTML plus a plain-text alternative (spec section 11).
// Every piece of third-party text (titles, names, evidence quotes) is HTML-escaped.
import type { Brief } from "@/lib/data/types";
import { BRIEF_TOP_N } from "@/lib/scoring";
import { formatCompact, formatIST, formatWeekLabel } from "@/lib/time";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const ACCENT = "#c2410c";
const INK = "#1c1917";
const MUTED = "#57534e";
const LINE = "#e7e5e4";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const briefSubject = (b: Brief) => `Podcast Intelligence Brief: Week of ${formatIST(`${b.weekStart}T00:00:00+05:30`, "weekday")}`;

const heat = { strong: "Strong signal", medium: "Medium signal", emerging: "Emerging" } as const;

function section(title: string, question: string, rows: string): string {
  return `<tr><td style="padding:28px 0 6px 0;font-family:${FONT};">
    <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${ACCENT};">${esc(title)}</div>
    <div style="font-size:14px;color:${MUTED};margin-top:2px;">${esc(question)}</div></td></tr>${rows}`;
}

const row = (inner: string) =>
  `<tr><td style="padding:12px 0;border-top:1px solid ${LINE};font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">${inner}</td></tr>`;

export function briefHtml(b: Brief, appUrl: string): string {
  const url = `${appUrl.replace(/\/$/, "")}/dashboard/briefs/${b.weekStart}`;
  const cov = b.coverage;
  const analysed = cov.analyzedVideo + cov.analyzedMetadata;

  const bullets = b.summary
    .map((s) => `<tr><td style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${INK};">&bull;&nbsp;${esc(s.text)}</td></tr>`)
    .join("");

  const guests = b.guests
    .slice(0, BRIEF_TOP_N)
    .map((g) => {
      const eps = g.appearances.slice(0, 2).map((a) => `${esc(a.showName)} (${esc(formatIST(a.publishedAt, "day"))})`).join(", ");
      return row(
        `<strong style="font-size:16px;">${esc(g.name)}</strong>${g.company ? `<span style="color:${MUTED};"> &middot; ${esc(g.company)}</span>` : ""}<br/>
        <span style="color:${ACCENT};font-weight:600;">${g.mediaRound ? `Media round: ${g.showsCount} shows in ${Math.max(g.spanDays, 1)} days` : `Top ${Math.max(100 - g.viewsPercentile, 1)}% by views`}</span>
        <span style="color:${MUTED};"> &middot; ${heat[g.heat]}</span><br/>
        <span style="color:${MUTED};">${eps}${g.topViews !== null ? ` &middot; best episode ${formatCompact(g.topViews)} views` : ""}</span>`,
      );
    })
    .join("");

  const topics = b.topics
    .slice(0, BRIEF_TOP_N)
    .map((t) =>
      row(
        `<strong style="font-size:16px;">${esc(t.label)}</strong>${t.rising ? `<span style="color:#137333;font-weight:600;"> &middot; Rising (${t.rising.thisWeek} this week vs ${t.rising.prevAvg} avg)</span>` : ""}<br/>
        <span style="color:${MUTED};">${t.showsCount} shows, ${t.episodesCount} episodes in 30 days</span>${t.counterAngle ? `<br/><span style="color:${INK};">Angle (AI suggestion): ${esc(t.counterAngle)}</span>` : ""}`,
      ),
    )
    .join("");

  const sponsors = b.sponsors
    .slice(0, BRIEF_TOP_N)
    .map((s) => {
      const m = s.mentions[0];
      return row(
        `<strong style="font-size:16px;">${esc(s.name)}</strong>${b.isFirstWeek ? "" : `<span style="color:${s.status === "new" ? "#137333" : MUTED};font-weight:600;"> &middot; ${s.status === "new" ? "New" : "Returning"}</span>`}
        <span style="color:${MUTED};"> &middot; ${s.showsCount} ${s.showsCount === 1 ? "show" : "shows"}</span>${m ? `<br/><span style="color:${MUTED};font-style:italic;">&ldquo;${esc(m.evidence)}&rdquo;</span>` : ""}`,
      );
    })
    .join("");

  const more = (n: number, what: string) => (n > BRIEF_TOP_N ? row(`<span style="color:${MUTED};">+ ${n - BRIEF_TOP_N} more ${what} in the full dashboard</span>`) : "");
  const empty = (msg: string) => row(`<span style="color:${MUTED};">${esc(msg)}</span>`);

  return `<!doctype html><html><body style="margin:0;padding:0;background:#fafaf9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:8px;">
<tr><td style="padding:28px 28px 8px 28px;font-family:${FONT};">
  <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${ACCENT};">Weekly brief &middot; ${esc(formatWeekLabel(b.weekStart))}</div>
  <div style="font-size:26px;line-height:32px;font-weight:700;color:${INK};margin-top:4px;">What matters this week</div>
</td></tr>
<tr><td style="padding:0 28px 24px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  ${bullets || `<tr><td style="font-family:${FONT};font-size:15px;color:${MUTED};">A quiet week.</td></tr>`}
  ${section("Trending guests", "Who is bookable right now?", (guests ? guests + more(b.guests.length, "guests") : empty("No trending guests this week.")))}
  ${section("Trending topics", "What is everyone covering?", (topics ? topics + more(b.topics.length, "topics") : empty("No topic is on 2+ shows yet.")))}
  ${section("Active sponsors", "Who is spending on podcast ads?", (sponsors ? sponsors + more(b.sponsors.length, "sponsors") : empty("No sponsors detected this week.")))}
  <tr><td style="padding:10px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Sponsors come from host-read and baked-in placements and description links. Dynamically inserted ads are not captured.</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:4px 28px 8px 28px;">
  <a href="${esc(url)}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:6px;">Open full dashboard</a>
</td></tr>
<tr><td style="padding:16px 28px 26px 28px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};text-align:center;">
  Analyzed ${analysed} of ${cov.episodesFound} episodes${cov.analyzedMetadata ? ` (${cov.analyzedMetadata} metadata-only)` : ""}${cov.skippedOrFailed ? `, ${cov.skippedOrFailed} skipped or failed` : ""}.
</td></tr>
</table></td></tr></table></body></html>`;
}

export function briefText(b: Brief, appUrl: string): string {
  const url = `${appUrl.replace(/\/$/, "")}/dashboard/briefs/${b.weekStart}`;
  const cov = b.coverage;
  const lines: string[] = [`PODCAST INTELLIGENCE BRIEF: Week of ${formatWeekLabel(b.weekStart)}`, "", "WHAT MATTERS THIS WEEK", ...b.summary.map((s) => `- ${s.text}`), ""];
  lines.push("TRENDING GUESTS");
  if (!b.guests.length) lines.push("- None this week.");
  for (const g of b.guests.slice(0, BRIEF_TOP_N)) {
    lines.push(`- ${g.name}${g.company ? ` (${g.company})` : ""}: ${g.mediaRound ? `media round, ${g.showsCount} shows in ${Math.max(g.spanDays, 1)} days` : `top ${Math.max(100 - g.viewsPercentile, 1)}% by views`}`);
  }
  if (b.guests.length > BRIEF_TOP_N) lines.push(`  + ${b.guests.length - BRIEF_TOP_N} more in the full dashboard`);
  lines.push("", "TRENDING TOPICS");
  if (!b.topics.length) lines.push("- None this week.");
  for (const t of b.topics.slice(0, BRIEF_TOP_N)) {
    lines.push(`- ${t.label}${t.rising ? " (rising)" : ""}: ${t.showsCount} shows, ${t.episodesCount} episodes`);
    if (t.counterAngle) lines.push(`  Angle (AI suggestion): ${t.counterAngle}`);
  }
  if (b.topics.length > BRIEF_TOP_N) lines.push(`  + ${b.topics.length - BRIEF_TOP_N} more in the full dashboard`);
  lines.push("", "ACTIVE SPONSORS");
  if (!b.sponsors.length) lines.push("- None this week.");
  for (const s of b.sponsors.slice(0, BRIEF_TOP_N)) lines.push(`- ${s.name}${b.isFirstWeek ? "" : ` (${s.status})`}: ${s.showsCount} ${s.showsCount === 1 ? "show" : "shows"}`);
  if (b.sponsors.length > BRIEF_TOP_N) lines.push(`  + ${b.sponsors.length - BRIEF_TOP_N} more in the full dashboard`);
  lines.push("", `Analyzed ${cov.analyzedVideo + cov.analyzedMetadata} of ${cov.episodesFound} episodes.`, "", `Open full dashboard: ${url}`);
  return lines.join("\n");
}
