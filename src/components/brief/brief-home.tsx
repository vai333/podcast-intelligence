import { ArrowRightLeft, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { AiTag } from "@/components/data/badges";
import type { Brief } from "@/lib/data/types";
import { BRIEF_TOP_N } from "@/lib/scoring";
import { formatIST, formatWeekLabel, formatWeekOf } from "@/lib/time";
import { ChapterCards, HomeStory, type Chapter } from "@/components/home/home-story";
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

function topOf(b: Brief, k: SectionKey): Chapter["top"] {
  const views = (n: number | null) => (n === null ? "" : ` · ${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(n)} views`);
  if (k === "guests") return b.guests.slice(0, 3).map((g) => ({ label: g.name, meta: `${g.showsCount} ${g.showsCount === 1 ? "show" : "shows"}${views(g.topViews)}` }));
  if (k === "topics") return b.topics.slice(0, 3).map((t) => ({ label: t.label, meta: `${t.showsCount} shows · ${t.episodesCount} eps${t.rising ? " · rising" : ""}` }));
  return b.sponsors.slice(0, 3).map((s) => ({ label: s.name, meta: `${s.showsCount} ${s.showsCount === 1 ? "show" : "shows"}${b.isFirstWeek ? "" : ` · ${s.status}`}` }));
}

/** The week's headline guests, topics and sponsors: the top few of each, with a link to the full list. */
function TopThree({ brief, base }: { brief: Brief; base: string }) {
  const cols = [
    {
      key: "guests" as const,
      title: "Guests",
      total: brief.guests.length,
      items: brief.guests.slice(0, BRIEF_TOP_N).map((g) => ({
        id: g.id,
        href: `/dashboard/guests/${g.id}`,
        label: g.name,
        meta: g.mediaRound ? `On ${g.showsCount} shows` : `${g.company ?? "Above-median views"}`,
      })),
    },
    {
      key: "topics" as const,
      title: "Topics",
      total: brief.topics.length,
      items: brief.topics.slice(0, BRIEF_TOP_N).map((t) => ({
        id: t.id,
        href: `/dashboard/topics/${t.id}`,
        label: t.label,
        meta: `${t.showsCount} shows · ${t.episodesCount} episodes${t.rising ? " · rising" : ""}`,
      })),
    },
    {
      key: "sponsors" as const,
      title: "Sponsors",
      total: brief.sponsors.length,
      items: brief.sponsors.slice(0, BRIEF_TOP_N).map((s) => ({
        id: s.id,
        href: `/dashboard/sponsors/${s.id}`,
        label: s.name,
        meta: `${s.showsCount} ${s.showsCount === 1 ? "show" : "shows"}${brief.isFirstWeek ? "" : ` · ${s.status}`}`,
      })),
    },
  ];
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="eyebrow">Top {BRIEF_TOP_N} this week</p>
      <div className="mt-3 grid gap-6 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.key} className="min-w-0">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{c.title}</h3>
            {c.items.length ? (
              <ol className="mt-2 space-y-2.5">
                {c.items.map((it, i) => (
                  <li key={it.id} className="flex gap-3">
                    <span className="num mt-0.5 w-4 shrink-0 text-xs text-accent">{i + 1}</span>
                    <span className="min-w-0">
                      <Link href={it.href} className="block break-words font-semibold hover:text-accent hover:underline">
                        {it.label}
                      </Link>
                      <span className="block break-words text-xs text-muted">{it.meta}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">None this week.</p>
            )}
            {c.total > BRIEF_TOP_N ? (
              <Link href={`${base}/${c.key}`} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                See all {c.total} →
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home: the scroll story first, then the week's brief summary and the three doors into the detail. */
export function BriefHome({ brief, weeks, latestWeek, showCount }: { brief: Brief; weeks: WeekOption[]; latestWeek: string; showCount?: number }) {
  const base = `/dashboard/briefs/${brief.weekStart}`;
  const chapters: Chapter[] = SECTION_KEYS.map((k) => ({
    key: k,
    title: SECTION_META[k].title,
    count: sectionCount(brief, k),
    question: SECTION_META[k].question,
    teaser: teaser(brief, k),
    href: `${base}/${k}`,
    top: topOf(brief, k),
  }));
  const intro = (
    <>
      <p className="eyebrow">Weekly brief · {formatWeekLabel(brief.weekStart)}</p>
      <h1 className="mt-2 text-[38px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">What the shows are saying</h1>
      <p className="mt-3 max-w-md text-[15px] text-muted">Every new episode, read by AI: the guests, the topics and who is paying for ads. Scroll to explore.</p>
      <MonitorPulse shows={showCount} className="mx-0 mt-6 max-w-[420px] items-start" />
    </>
  );
  return (
    <>
      <HomeStory chapters={chapters} intro={intro} briefId="brief" />
      <div id="brief" className="mx-auto max-w-[960px] scroll-mt-20 pt-8">
        <header className="mb-8 text-center">
          <p className="eyebrow">The brief</p>
          <h2 className="mx-auto mt-2 max-w-[18ch] text-[36px] font-bold leading-[1.1] tracking-tight sm:text-5xl">{formatWeekOf(brief.weekStart)}</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-muted">What mattered across the shows you watch, Monday to Sunday.</p>
          <div className="mt-5 flex justify-center">
            <WeekSelector current={brief.weekStart} prev={brief.prevWeek} next={brief.nextWeek} latest={latestWeek} options={weeks} />
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              Generated <span className="num">{formatIST(brief.generatedAt, "daytime")}</span>
            </span>
            {brief.sentAt || brief.isLatest ? (
              <span className="inline-flex items-center gap-1">
                <Mail size={12} aria-hidden />
                {brief.sentAt ? <>Emailed <span className="num">{formatIST(brief.sentAt, "daytime")}</span></> : "Not emailed yet. Retry from the System page."}
              </span>
            ) : null}
          </p>
        </header>

        {!brief.isLatest ? <FrozenNotice /> : null}

        <section aria-labelledby="matters-heading" className="mb-10 rounded-panel border border-border bg-surface p-5 sm:p-7">
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
                  <span className="min-w-0 break-words">
                    {b.text}{" "}
                    {b.refs.map((r) => (
                      <Link
                        key={r.id}
                        href={`/dashboard/${r.kind === "guest" ? "guests" : r.kind === "topic" ? "topics" : "sponsors"}/${r.id}`}
                        className="mr-3 font-semibold text-accent hover:underline"
                      >
                        {r.label} →
                      </Link>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Nothing stood out this week. A quiet week is normal early on.</p>
          )}
          <TopThree brief={brief} base={base} />
          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <CoverageLine coverage={brief.coverage} />
            {brief.lineupChanges.length ? (
              <p className="flex items-start gap-2 text-sm text-muted">
                <ArrowRightLeft size={16} aria-hidden className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
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

        <section aria-labelledby="dive-heading">
          <p className="eyebrow">Dive in</p>
          <h2 id="dive-heading" className="mb-4 mt-1 text-[26px] font-bold leading-8 tracking-tight">See the detail</h2>
          <ChapterCards chapters={chapters} />
        </section>
      </div>
    </>
  );
}
