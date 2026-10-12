import { notFound } from "next/navigation";
import { BriefHome } from "@/components/brief/brief-home";
import { repo } from "@/lib/data";
import { formatWeekLabel } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  return { title: `Brief, ${formatWeekLabel(week)}` };
}

export default async function BriefByWeekPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const [brief, list, latest] = await Promise.all([repo.getBrief(week), repo.listBriefs(), repo.getLatestBrief()]);
  if (!brief || !latest) notFound();
  const weeks = list.map((b) => ({ value: b.weekStart, label: formatWeekLabel(b.weekStart) }));
  return <BriefHome brief={brief} weeks={weeks} latestWeek={latest.weekStart} showCount={(await repo.getLineup()).active.length} />;
}
