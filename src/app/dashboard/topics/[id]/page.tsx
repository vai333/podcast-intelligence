import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeLine } from "@/components/data/episode-line";
import { WeeklyChart } from "@/components/charts/weekly-chart-loader";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { repo } from "@/lib/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = await repo.getTopic((await params).id);
  return { title: t?.label ?? "Topic" };
}

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await repo.getTopic((await params).id);
  if (!t) notFound();
  return (
    <div>
      <PageHeader
        back={<Link href="/dashboard/topics" className="inline-flex items-center gap-1 text-accent hover:underline"><ChevronLeft size={14} aria-hidden /> Topics</Link>}
        title={t.label}
        subtitle={`${t.episodes.length} episodes across ${t.shows.length} shows`}
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
        {t.shows.map((s) => <Chip key={s} tone="neutral">{s}</Chip>)}
      </div>
      <section aria-labelledby="w-h" className="mb-8 rounded-panel border border-border bg-surface p-4 sm:p-5">
        <h2 id="w-h" className="mb-1 text-lg font-semibold">Episodes per week</h2>
        <WeeklyChart weeks={t.weeks} series={[{ name: "Episodes", values: t.weekly }]} label={`Episodes per week about ${t.label}`} height={240} />
      </section>
      <section aria-labelledby="e-h">
        <h2 id="e-h" className="mb-2 text-lg font-semibold">Episodes</h2>
        <div className="divide-y divide-border rounded-panel border border-border bg-surface px-4">
          {t.episodes.slice(0, 30).map((e) => <EpisodeLine key={e.episodeId} ep={e} />)}
        </div>
      </section>
    </div>
  );
}
