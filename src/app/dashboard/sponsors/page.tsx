import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PLACEMENT_LABEL } from "@/components/data/badges";
import { type Column, DataTable } from "@/components/data/data-table";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { ExploreTabs } from "@/components/shell/explore-tabs";
import { repo } from "@/lib/data";
import type { SponsorListItem } from "@/lib/data/types";
import { formatIST } from "@/lib/time";

export const metadata: Metadata = { title: "Sponsors" };

export default async function SponsorsPage() {
  const sponsors = await repo.listSponsors();
  const columns: Column<SponsorListItem>[] = [
    {
      key: "n",
      header: "Sponsor",
      primary: true,
      render: (s) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/sponsors/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
          {s.activeThisWeek ? <Chip tone="success">Active this week</Chip> : null}
        </span>
      ),
    },
    { key: "f", header: "First seen", render: (s) => <span className="num">{formatIST(s.firstSeenAt, "day")}</span> },
    { key: "l", header: "Last seen", render: (s) => <span className="num">{formatIST(s.lastSeenAt, "day")}</span> },
    { key: "sh", header: "Shows", numeric: true, render: (s) => s.showsCount },
    { key: "m", header: "Mentions", numeric: true, render: (s) => s.mentionsCount },
    { key: "p", header: "Placements", render: (s) => <span className="text-muted">{s.placements.map((p) => PLACEMENT_LABEL[p]).join(", ")}</span> },
  ];
  return (
    <div>
      <PageHeader title="Sponsors" subtitle="Brands promoted on your monitored shows. Host-read and baked-in placements only; dynamically inserted ads are not captured." />
      <ExploreTabs active="Sponsors" />
      <DataTable
        caption="Sponsors"
        columns={columns}
        rows={sponsors}
        rowKey={(s) => s.id}
        empty={
          <EmptyState icon={<Megaphone size={20} />} title="No sponsors detected yet" when="Checked every night as new episodes are analysed.">
            We look for sponsor reads, discount codes, on-screen cards and sponsor links in descriptions.
          </EmptyState>
        }
      />
    </div>
  );
}
