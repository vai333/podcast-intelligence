import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { BriefHome } from "@/components/brief/brief-home";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { repo } from "@/lib/data";
import { formatWeekLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Latest brief" };

export default async function LatestBriefPage() {
  const [brief, list] = await Promise.all([repo.getLatestBrief(), repo.listBriefs()]);

  if (!brief) {
    return (
      <div className="mx-auto max-w-[760px]">
        <p className="eyebrow">Weekly brief</p>
        <h1 className="mb-6 mt-1 text-[40px] font-bold leading-[1.1] tracking-tight">Latest brief</h1>
        <EmptyState
          icon={<CalendarClock size={20} />}
          title="Your first brief arrives on Monday"
          when="Monday at about 7:00 AM IST, by email and here. It covers the Monday to Sunday week that just ended."
          action={<LinkButton href="/dashboard/shows" variant="primary">Review monitored shows</LinkButton>}
        >
          We are watching your shows now. New episodes are found every night and analysed for guests, topics and sponsors. Nothing to read yet.
        </EmptyState>
      </div>
    );
  }

  const weeks = list.map((b) => ({ value: b.weekStart, label: formatWeekLabel(b.weekStart) }));
  return <BriefHome brief={brief} weeks={weeks} latestWeek={brief.weekStart} showCount={(await repo.getLineup()).active.length} />;
}
