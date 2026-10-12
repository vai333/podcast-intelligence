import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MediaRoundBadge } from "@/components/data/badges";
import { type Column, DataTable } from "@/components/data/data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { ExploreTabs } from "@/components/shell/explore-tabs";
import { repo } from "@/lib/data";
import type { GuestListItem } from "@/lib/data/types";
import { formatCompact, formatIST } from "@/lib/time";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const guests = await repo.listGuests(q);

  const columns: Column<GuestListItem>[] = [
    {
      key: "name",
      header: "Guest",
      primary: true,
      render: (g) => (
        <div>
          <Link href={`/dashboard/guests/${g.id}`} className="font-medium hover:underline">{g.name}</Link>
          {g.company ? <p className="text-xs text-muted">{g.company}</p> : null}
        </div>
      ),
    },
    { key: "shows", header: "Shows (30d)", numeric: true, render: (g) => g.showsCount30d },
    { key: "apps", header: "Appearances", numeric: true, render: (g) => g.appearances },
    { key: "last", header: "Last seen", render: (g) => <span className="num">{formatIST(g.lastSeen, "day")}</span> },
    { key: "views", header: "Best episode views", numeric: true, render: (g) => (g.topViews !== null ? formatCompact(g.topViews) : <span className="text-muted">n/a</span>) },
    { key: "signal", header: "Signal", render: (g) => (g.mediaRound ? <MediaRoundBadge shows={g.showsCount30d} days={0} /> : <span className="text-muted">None</span>) },
  ];

  return (
    <div>
      <PageHeader title="Guests" subtitle="Everyone who has appeared on the shows you monitor." />
      <ExploreTabs active="Guests" />
      <form method="get" className="mb-4 flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search guests</label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search by name or company"
          className="h-10 min-w-0 flex-1 rounded-chip border border-border bg-surface px-3 text-sm placeholder:text-muted"
        />
        <Button type="submit" variant="secondary"><Search size={16} aria-hidden /> Search</Button>
      </form>
      <DataTable
        caption="Guests"
        columns={columns}
        rows={guests}
        rowKey={(g) => g.id}
        empty={
          <EmptyState
            icon={<Users size={20} />}
            title={q ? `No guests match "${q}"` : "No guests yet"}
            when={q ? undefined : "Guests appear here as soon as the first episodes are analysed after tonight's check."}
          >
            {q ? "Try part of a name or a company." : "We list everyone interviewed or featured on your monitored shows."}
          </EmptyState>
        }
      />
    </div>
  );
}
