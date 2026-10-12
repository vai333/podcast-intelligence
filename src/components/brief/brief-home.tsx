import { ArrowRight, ArrowRightLeft, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { AiTag } from "@/components/data/badges";
import type { Brief } from "@/lib/data/types";
import { formatIST, formatWeekLabel, formatWeekOf } from "@/lib/time";
import { MonitorPulse } from "./monitor-pulse";
import { CoverageLine } from "./coverage-line";
import { SECTION_KEYS, SECTION_META, sectionCount, type SectionKey } from "./sections";
import { WeekSelector, type WeekOption } from "./week-selector";

/** One short teaser per section so the buttons say what is inside without listing it. */
function teaser(b: Brief, k: SectionKey): string {
  if (k === "guests") {
    const g = b.guests[0];
    if (!g) return "Nobody on a media round this week";
    return g.mediaRound ? `${g.name} is on ${g.showsCount} shows` : `${g.name} is trending on views`;
  }
  if (k === "topics") {
    const t = b.topics.find((x) => x.rising) ?? b.topics[0];
    if (!t) return "No topic is on 2+ shows yet";
    return `${t.label}${t.rising ? " is rising" : " leads"}`;
  }
  const fresh = b.sponsors.filter((s) => s.status === "new").length;
  if (!b.sponsors.length) return "No sponsors detected this week";
  return !b.isFirstWeek && fresh ? `${fresh} new ${fresh === 1 ? "sponsor" : "sponsors"} this week` : `${b.sponsors[0].name} is most active`;
}

export function FrozenNotice() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface px-4 py-3 text-sm">
      <Lock size={16} aria-hidden className="shrink-0 text-muted" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Frozen brief.</span> <span className="text-muted">This page never changes, even if shows are swapped later.</span>
      </p>
      <Link href="/dashboard" className="font-semibold text-accent hover:underline">
        Go to latest
      </Link>
    </div>
  );
}

/** Home: the week's headline summary and three doors into the detail. Nothing else. */
export function BriefHome({ brief, weeks, latestWeek, showCount }: { brief: Brief; weeks: WeekOption[]; latestWeek: string; showCount?: number }) {
  const base = `/dashboard/briefs/${brief.weekStart}`;
  return (
    <div className="mx-auto max-w-[960px]">
      <header className="hero-glow -mx-4 mb-8 px-4 pb-8 pt-4 text-center md:-mx-6 md:px-6">
        <p className="eyebrow">Weekly brief · {formatWeekLabel(brief.weekStart)}</p>
        <h1 className="mx-auto mt-2 max-w-[18ch] text-[40px] font-bold leading-[1.1] tracking-tight sm:text-5xl">
          {formatWeekOf(brief.weekStart)}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[15px] text-muted">What mattered across the shows you watch, Monday to Sunday.</p>
        <MonitorPulse shows={showCount} className="mt-6" />
        <div className="mt-5 flex justify-center">
          <WeekSelector current={brief.weekStart} prev={brief.prevWeek} next={brief.nextWeek} latest={latestWeek} options={weeks} />
        </div>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            Generated <span className="num">{formatIST(brief.generatedAt, "daytime")}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Mail size={12} aria-hidden />
            {brief.sentAt ? <>Emailed <span className="num">{formatIST(brief.sentAt, "daytime")}</span></> : "Not emailed yet. Retry from the System page."}
          </span>
        </p>
      </header>

      {!brief.isLatest ? <FrozenNotice /> : null}

      <section aria-labelledby="matters-heading" className="mb-8 rounded-panel border border-border bg-surface p-5 sm:p-7">
        <p className="eyebrow">Summary</p>
        <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
          <h2 id="matters-heading" className="text-[26px] font-bold leading-8 tracking-tight">What matters this week</h2>
          <AiTag>AI-written, checked against the data</AiTag>
        </div>
        {brief.summary.length ? (
          <ul className="space-y-3.5">
            {brief.summary.map((b) => (
              <li key={b.text} className="flex gap-3 text-base leading-7">
                <span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>
                  {b.text}{" "}
                  {b.refs.map((r) => (
                    <Link
                      key={r.id}
                      href={`/dashboard/${r.kind === "guest" ? "guests" : r.kind === "topic" ? "topics" : "sponsors"}/${r.id}`}
                      className="whitespace-nowrap font-semibold text-accent hover:underline"
                    >
                      {r.label} →
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nothing stood out this week. A quiet week is normal early on.</p>
        )}
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <CoverageLine coverage={brief.coverage} />
          {brief.lineupChanges.length ? (
            <p className="flex items-start gap-2 text-sm text-muted">
              <ArrowRightLeft size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Lineup changed: {brief.lineupChanges.map((c) => `${c.showName} ${c.kind === "added" ? "added" : "removed"} ${formatIST(c.at, "day")}`).join(", ")}.{" "}
                <Link href="/dashboard/shows" className="font-medium text-accent hover:underline">Lineup history</Link>
              </span>
            </p>
          ) : null}
          {brief.isFirstWeek ? (
            <p className="text-sm text-info">First week of tracking. New and Returning labels appear from week 2.</p>
          ) : null}
        </div>
      </section>

      <nav aria-label="Brief sections">
        <p className="eyebrow">Dive in</p>
        <h2 className="mb-4 mt-1 text-[26px] font-bold leading-8 tracking-tight">See the detail</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {SECTION_KEYS.map((k) => {
            const m = SECTION_META[k];
            const n = sectionCount(brief, k);
            return (
              <li key={k}>
                <Link
                  href={`${base}/${k}`}
                  className="group flex h-full flex-col rounded-panel border border-border bg-surface p-5 transition-colors hover:border-accent"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-chip border border-border text-accent group-hover:border-accent">
                    <m.icon size={20} aria-hidden />
                  </span>
                  <span className="mt-4 flex items-baseline gap-2">
                    <span className="text-xl font-bold">{m.title}</span>
                    <span className="num text-sm text-muted">{n}</span>
                  </span>
                  <span className="mt-1 text-sm text-muted">{m.question}</span>
                  <span className="mt-4 text-sm font-medium">{teaser(brief, k)}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-accent">
                    Open {m.title.toLowerCase()} <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
