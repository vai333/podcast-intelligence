import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ShowsManager } from "@/components/shows/shows-manager";
import { Timeline } from "@/components/shows/timeline";
import { repo } from "@/lib/data";

export const metadata: Metadata = { title: "Shows" };

export default async function ShowsPage() {
  const lineup = await repo.getLineup();
  return (
    <div>
      <PageHeader
        title="Monitored shows"
        subtitle="A swap takes effect from the moment you confirm it. The new show is never backfilled, and nothing from the old one is deleted."
      />
      <ShowsManager lineup={lineup} />
      <section aria-labelledby="timeline-h" className="mt-10">
        <h2 id="timeline-h" className="mb-3 text-lg font-semibold">Lineup history</h2>
        <div className="rounded-panel border border-border bg-surface p-4 sm:p-5">
          <Timeline lineup={lineup} />
        </div>
      </section>
    </div>
  );
}
