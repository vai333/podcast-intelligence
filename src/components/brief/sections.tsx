import { Hash, Megaphone, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import type { Brief } from "@/lib/data/types";
import { GuestRow } from "./guest-row";
import { Disclosure } from "./rank-row";
import { SponsorRow } from "./sponsor-row";
import { TopicRow } from "./topic-row";

export type SectionKey = "guests" | "topics" | "sponsors";

export const SECTION_KEYS: SectionKey[] = ["guests", "topics", "sponsors"];

export const SECTION_META: Record<SectionKey, { title: string; question: string; icon: LucideIcon; note?: string }> = {
  guests: { title: "Guests", question: "Who is bookable right now?", icon: Users },
  topics: { title: "Topics", question: "What is everyone covering, and where can you do something different?", icon: Hash },
  sponsors: {
    title: "Sponsors",
    question: "Which brands are spending on podcast ads right now?",
    icon: Megaphone,
    note: "Sponsors come from host-read and baked-in placements, plus links in descriptions. Dynamically inserted audio ads are not captured.",
  },
};

export const isSection = (s: string): s is SectionKey => (SECTION_KEYS as string[]).includes(s);

export const sectionCount = (b: Brief, k: SectionKey) => b[k].length;

export function GuestsList({ brief }: { brief: Brief }) {
  if (!brief.guests.length) {
    return (
      <EmptyState title="No trending guests this week" when="Checked every Monday. A media round shows up as soon as someone appears on 2 or more shows.">
        No guest appeared on 2 or more shows this month, and none is in the top 10% by views.
      </EmptyState>
    );
  }
  return <ol>{brief.guests.map((g) => <GuestRow key={g.id} g={g} />)}</ol>;
}

export function TopicsList({ brief }: { brief: Brief }) {
  return (
    <>
      {brief.topics.length ? (
        <ol>{brief.topics.map((t) => <TopicRow key={t.id} t={t} />)}</ol>
      ) : (
        <EmptyState title="No topic is trending yet" when="Usually fills in by week 3 of tracking.">
          A topic needs 3 episodes across 2 shows in 30 days, with at least one this week.
        </EmptyState>
      )}
      {brief.emergingTopics.length ? (
        <Disclosure summary={`Emerging, not trending yet (${brief.emergingTopics.length})`} className="mt-3">
          <ul className="divide-y divide-border rounded-panel border border-border bg-surface">
            {brief.emergingTopics.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/dashboard/topics/${t.id}`} className="font-medium hover:underline">{t.label}</Link>
                <span className="text-muted">
                  <span className="num">{t.showsCount}</span> {t.showsCount === 1 ? "show" : "shows"}, <span className="num">{t.episodesCount}</span> episodes. Needs {t.needs}.
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </>
  );
}

export function SponsorsList({ brief }: { brief: Brief }) {
  if (!brief.sponsors.length) {
    return (
      <EmptyState title="No sponsors detected this week" when="Checked every Monday.">
        Only baked-in and host-read ads are captured, so a quiet week is possible.
      </EmptyState>
    );
  }
  return <ol>{brief.sponsors.map((s) => <SponsorRow key={s.id} s={s} hideStatus={brief.isFirstWeek} />)}</ol>;
}
