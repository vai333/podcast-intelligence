import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WeeklyChart } from "@/components/charts/weekly-chart-loader";
import { SponsorMentionItem } from "@/components/brief/sponsor-row";
import { PageHeader } from "@/components/ui/page-header";
import { repo } from "@/lib/data";
import { formatIST } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await repo.getSponsor((await params).id);
  return { title: s?.name ?? "Sponsor" };
}

export default async function SponsorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await repo.getSponsor((await params).id);
  if (!s) notFound();
  return (
    <div>
      <PageHeader
        back={<Link href="/dashboard/sponsors" className="inline-flex items-center gap-1 text-accent hover:underline"><ChevronLeft size={14} aria-hidden /> Sponsors</Link>}
        title={s.name}
        subtitle={<>First seen <span className="num">{formatIST(s.firstSeenAt, "day")}</span> · {s.mentions.length} mentions</>}
      />
      <section aria-labelledby="w-h" className="mb-8 rounded-panel border border-border bg-surface p-4 sm:p-5">
        <h2 id="w-h" className="mb-1 text-lg font-semibold">Mentions per week</h2>
        <WeeklyChart weeks={s.weeks} series={[{ name: "Mentions", values: s.weekly }]} label={`Mentions of ${s.name} per week`} height={220} />
      </section>
      <section aria-labelledby="m-h">
        <h2 id="m-h" className="mb-2 text-lg font-semibold">Mentions</h2>
        <div className="divide-y divide-border rounded-panel border border-border bg-surface px-4">
          {s.mentions.map((m) => <SponsorMentionItem key={m.episode.episodeId + m.placement} m={m} />)}
        </div>
      </section>
    </div>
  );
}
