import { ChevronLeft, GitMerge } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeatLabel, MediaRoundBadge, TopViewsBadge } from "@/components/data/badges";
import { type Column, DataTable } from "@/components/data/data-table";
import { SourceLinks } from "@/components/data/source-link";
import { Swimlane } from "@/components/charts/swimlane";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { Tip } from "@/components/ui/tooltip";
import { MetadataOnlyBadge } from "@/components/data/badges";
import { repo } from "@/lib/data";
import type { EpisodeRef } from "@/lib/data/types";
import { formatCompact, formatIST } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const g = await repo.getGuest((await params).id);
  return { title: g?.name ?? "Guest" };
}

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [g, meta] = await Promise.all([repo.getGuest(id), repo.meta()]);
  if (!g) notFound();

  const columns: Column<EpisodeRef>[] = [
    { key: "t", header: "Episode", primary: true, render: (e) => <span className="break-words">{e.title}</span> },
    { key: "s", header: "Show", render: (e) => e.showName },
    { key: "d", header: "Date (IST)", render: (e) => <span className="num">{formatIST(e.publishedAt, "day")}</span> },
    { key: "v", header: "Views", numeric: true, render: (e) => (e.views !== null ? formatCompact(e.views) : <span className="text-muted">n/a</span>) },
    { key: "depth", header: "Analysis", render: (e) => (e.depth === "metadata" ? <MetadataOnlyBadge /> : <span className="text-muted">Video</span>) },
    { key: "l", header: "Links", render: (e) => <SourceLinks youtubeUrl={e.youtubeUrl} spotifyUrl={e.spotifyUrl} /> },
  ];

  return (
    <div>
      <PageHeader
        back={<Link href="/dashboard/guests" className="inline-flex items-center gap-1 text-accent hover:underline"><ChevronLeft size={14} aria-hidden /> Guests</Link>}
        title={g.name}
        subtitle={g.company}
        actions={
          <Tip content="Merging duplicate guests and fixing names arrives with the live system.">
            <span tabIndex={0}>
              <Button size="sm" variant="secondary" disabled><GitMerge size={14} aria-hidden /> Merge or rename</Button>
            </span>
          </Tip>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {g.mediaRound ? <MediaRoundBadge shows={g.showsCount30d} days={g.spanDays} /> : <Chip tone="outline">No media round in the last 30 days</Chip>}
        {g.viewsPercentile >= 90 ? <TopViewsBadge percentile={g.viewsPercentile} /> : null}
        {g.heat ? <HeatLabel heat={g.heat} /> : null}
        {g.aliases.length ? (
          <span className="text-sm text-muted">Also seen as {g.aliases.map((a) => `"${a}"`).join(", ")} <Chip tone="neutral">Merged</Chip></span>
        ) : null}
      </div>

      <section aria-labelledby="lane-h" className="mb-8 rounded-panel border border-border bg-surface p-4 sm:p-5">
        <h2 id="lane-h" className="text-lg font-semibold">Last 30 days across shows</h2>
        <p className="mb-3 text-sm text-muted">One row per show, one dot per episode. Bigger dot means more YouTube views.</p>
        <Swimlane episodes={g.appearances} lanes={g.lane} now={meta.now} />
      </section>

      <section aria-labelledby="apps-h">
        <h2 id="apps-h" className="mb-3 text-lg font-semibold">All appearances</h2>
        <DataTable caption={`Appearances by ${g.name}`} columns={columns} rows={g.appearances} rowKey={(e) => e.episodeId} />
      </section>
    </div>
  );
}
