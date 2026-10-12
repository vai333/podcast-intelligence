import { CircleAlert, CircleCheck, CircleSlash, ListVideo } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MetadataOnlyBadge } from "@/components/data/badges";
import { type Column, DataTable } from "@/components/data/data-table";
import { SourceLinks } from "@/components/data/source-link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { RerunButton } from "@/components/shows/rerun-button";
import { repo } from "@/lib/data";
import type { AnalysisDepth, EpisodeRow, EpisodeStatus } from "@/lib/data/types";
import { formatCompact, formatDuration, formatIST } from "@/lib/time";

export const metadata: Metadata = { title: "Episodes" };

type Sp = { show?: string; status?: string; depth?: string; sort?: string; page?: string };

const STATUS: Record<EpisodeStatus, { tone: "success" | "danger" | "warn" | "neutral"; label: string; icon: React.ReactNode }> = {
  extracted: { tone: "success", label: "Analysed", icon: <CircleCheck size={12} /> },
  failed: { tone: "danger", label: "Failed", icon: <CircleAlert size={12} /> },
  skipped: { tone: "warn", label: "Skipped", icon: <CircleSlash size={12} /> },
  discovered: { tone: "neutral", label: "Queued", icon: <ListVideo size={12} /> },
};

export default async function EpisodesPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const status = (["extracted", "failed", "skipped", "discovered"] as const).find((s) => s === sp.status);
  const depth = (["video", "metadata"] as const).find((d) => d === sp.depth) as AnalysisDepth | undefined;
  const sort = sp.sort === "views" ? "views" : "published";
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ rows, total, pageSize }, lineup] = await Promise.all([
    repo.listEpisodes({ show: sp.show || undefined, status, depth, sort, page }),
    repo.getLineup(),
  ]);

  const href = (over: Partial<Sp>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    const s = p.toString();
    return `/dashboard/episodes${s ? `?${s}` : ""}`;
  };

  const columns: Column<EpisodeRow>[] = [
    {
      key: "t",
      header: "Episode",
      primary: true,
      className: "w-[34%]",
      render: (e) => (
        <div className="min-w-0">
          <p className="break-words font-medium leading-5">{e.title}</p>
          <p className="text-xs text-muted">{e.showName}</p>
          {e.statusNote ? <p className="mt-1 text-xs text-muted">{e.statusNote}</p> : null}
        </div>
      ),
    },
    { key: "p", header: "Published (IST)", render: (e) => <span className="num">{formatIST(e.publishedAt, "day")}</span> },
    { key: "d", header: "Length", numeric: true, render: (e) => formatDuration(e.durationMin) },
    { key: "v", header: "Views", numeric: true, sort: "views", render: (e) => (e.views !== null ? formatCompact(e.views) : <span className="text-muted">n/a</span>) },
    {
      key: "s",
      header: "Status",
      render: (e) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Chip tone={STATUS[e.status].tone} icon={STATUS[e.status].icon}>{STATUS[e.status].label}</Chip>
          {e.status === "extracted" && e.depth === "metadata" ? <MetadataOnlyBadge /> : null}
        </span>
      ),
    },
    {
      key: "x",
      header: "Found",
      hideOnMobile: true,
      render: (e) =>
        e.status === "extracted" ? (
          <span className="num text-xs text-muted">{e.guests.length} guests · {e.topics.length} topics · {e.sponsors.length} sponsors</span>
        ) : (
          <span className="text-muted">n/a</span>
        ),
    },
    { key: "l", header: "Links", render: (e) => <SourceLinks youtubeUrl={e.youtubeUrl} spotifyUrl={e.spotifyUrl} /> },
    { key: "a", header: "Actions", srOnlyHeader: true, render: (e) => <RerunButton episodeId={e.id} title={e.title} /> },
  ];

  const filtersActive = !!(sp.show || status || depth);

  return (
    <div>
      <PageHeader title="Episodes" subtitle={<>Everything discovered on monitored shows. <span className="num">{total}</span> {total === 1 ? "episode" : "episodes"}{filtersActive ? " match your filters" : ""}.</>} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filter episodes">
        {[
          { name: "show", label: "Show", value: sp.show ?? "", options: [["", "All shows"], ...[...lineup.active, ...lineup.past].map((s) => [s.id, s.name] as const)] },
          { name: "status", label: "Status", value: status ?? "", options: [["", "Any status"], ["extracted", "Analysed"], ["failed", "Failed"], ["skipped", "Skipped"]] },
          { name: "depth", label: "Analysis", value: depth ?? "", options: [["", "Any depth"], ["video", "Video"], ["metadata", "Metadata only"]] },
        ].map((f) => (
          <label key={f.name} className="text-xs font-medium text-muted">
            {f.label}
            <select name={f.name} defaultValue={f.value} className="mt-1 block h-10 min-w-[150px] rounded-chip border border-border bg-surface px-3 text-sm font-normal text-fg">
              {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ))}
        <input type="hidden" name="sort" value={sort} />
        <Button type="submit" variant="secondary">Apply</Button>
        {filtersActive ? <Link href="/dashboard/episodes" className="pb-2.5 text-sm font-medium text-accent hover:underline">Clear filters</Link> : null}
      </form>

      <DataTable
        caption="Episodes"
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        sortHref={(s) => href({ sort: s, page: undefined })}
        activeSort={sort}
        empty={
          <EmptyState icon={<ListVideo size={20} />} title={filtersActive ? "No episodes match these filters" : "No episodes yet"} when={filtersActive ? undefined : "New episodes are discovered every night shortly after midnight IST."}>
            {filtersActive ? "Try clearing a filter." : "Only episodes published after a show was added are tracked, so a brand-new lineup starts empty."}
          </EmptyState>
        }
      />

      {total > pageSize ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="font-medium text-accent hover:underline">← Newer</Link> : <span />}
          <span className="num text-muted">Page {page} of {Math.ceil(total / pageSize)}</span>
          {page * pageSize < total ? <Link href={href({ page: String(page + 1) })} className="font-medium text-accent hover:underline">Older →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
