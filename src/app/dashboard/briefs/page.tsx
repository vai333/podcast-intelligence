import { CalendarClock, Mail, MailX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { repo } from "@/lib/data";
import { formatIST, formatWeekLabel, formatWeekOf } from "@/lib/time";

export const metadata: Metadata = { title: "Past briefs" };

export default async function BriefsPage() {
  const briefs = await repo.listBriefs();
  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title="Past briefs" subtitle="Every brief is frozen: it shows exactly what was sent, even if shows were swapped later." />
      {briefs.length === 0 ? (
        <EmptyState icon={<CalendarClock size={20} />} title="No briefs yet" when="Your first one arrives on Monday at about 7:00 AM IST.">
          Briefs are created every Monday for the week that just ended, then kept here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-panel border border-border bg-surface">
          {briefs.map((b, i) => {
            const analyzed = b.coverage.analyzedVideo + b.coverage.analyzedMetadata;
            return (
              <li key={b.weekStart}>
                <Link
                  href={i === 0 ? "/dashboard" : `/dashboard/briefs/${b.weekStart}`}
                  className="flex flex-col gap-2 px-4 py-4 hover:bg-surface-2/60 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="sm:w-44 sm:shrink-0">
                    <p className="font-semibold">{formatWeekOf(b.weekStart)}</p>
                    <p className="num text-xs text-muted">{formatWeekLabel(b.weekStart)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{b.headline}</p>
                    <p className="num mt-1 text-xs text-muted">
                      {b.guestsCount} guests · {b.topicsCount} topics · {b.sponsorsCount} sponsors · analyzed {analyzed} of {b.coverage.episodesFound} episodes
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {i === 0 ? <Chip tone="accent">Latest</Chip> : null}
                    {b.sentAt ? (
                      <Chip tone="neutral" icon={<Mail size={12} />}>
                        Sent <span className="num">{formatIST(b.sentAt, "day")}</span>
                      </Chip>
                    ) : (
                      <Chip tone="warn" icon={<MailX size={12} />}>Not sent</Chip>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
