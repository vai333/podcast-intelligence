import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FrozenNotice } from "@/components/brief/brief-home";
import {
  GuestsList,
  SECTION_KEYS,
  SECTION_META,
  SponsorsList,
  TopicsList,
  isSection,
  sectionCount,
} from "@/components/brief/sections";
import { WeekSelector } from "@/components/brief/week-selector";
import { PageHeader } from "@/components/ui/page-header";
import { repo } from "@/lib/data";
import { formatWeekLabel, formatWeekOf } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ week: string; section: string }> }) {
  const { week, section } = await params;
  return { title: isSection(section) ? `${SECTION_META[section].title}, ${formatWeekOf(week)}` : "Brief" };
}

export default async function BriefSectionPage({ params }: { params: Promise<{ week: string; section: string }> }) {
  const { week, section } = await params;
  if (!isSection(section)) notFound();
  const [brief, list, latest] = await Promise.all([repo.getBrief(week), repo.listBriefs(), repo.getLatestBrief()]);
  if (!brief || !latest) notFound();

  const meta = SECTION_META[section];
  const weeks = list.map((b) => ({ value: b.weekStart, label: formatWeekLabel(b.weekStart) }));
  const home = brief.isLatest ? "/dashboard" : `/dashboard/briefs/${brief.weekStart}`;

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        back={
          <Link href={home} className="inline-flex items-center gap-1 text-accent hover:underline">
            <ChevronLeft size={14} aria-hidden /> Summary
          </Link>
        }
        eyebrow={formatWeekOf(brief.weekStart)}
        title={meta.title}
        subtitle={meta.question}
        actions={<WeekSelector current={brief.weekStart} prev={brief.prevWeek} next={brief.nextWeek} latest={latest.weekStart} options={weeks} section={section} />}
      />

      <nav aria-label="Brief sections" className="mb-5 inline-flex rounded-chip border border-border bg-surface p-1">
        {SECTION_KEYS.map((k) => (
          <Link
            key={k}
            href={`/dashboard/briefs/${brief.weekStart}/${k}`}
            aria-current={k === section ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-sm font-medium",
              k === section ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {SECTION_META[k].title}
            <span className="num text-xs opacity-80">{sectionCount(brief, k)}</span>
          </Link>
        ))}
      </nav>

      {!brief.isLatest ? <FrozenNotice /> : null}
      {meta.note ? <p className="mb-2 rounded-chip border border-border bg-surface px-3 py-2 text-xs leading-5 text-muted">{meta.note}</p> : null}

      {section === "guests" ? <GuestsList brief={brief} /> : section === "topics" ? <TopicsList brief={brief} /> : <SponsorsList brief={brief} />}

      <p className="mt-8 border-t border-border pt-4 text-sm text-muted">
        Looking for someone from before this week?{" "}
        <Link href={`/dashboard/${section}`} className="font-semibold text-accent hover:underline">
          See all {meta.title.toLowerCase()} ever tracked
        </Link>
      </p>
    </div>
  );
}
