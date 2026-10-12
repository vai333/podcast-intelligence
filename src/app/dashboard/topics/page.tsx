import { Hash } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { WeeklyChart } from "@/components/charts/weekly-chart-loader";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { ExploreTabs } from "@/components/shell/explore-tabs";
import { Sparkline } from "@/components/data/sparkline";
import { repo } from "@/lib/data";
import { formatIST, startOfDayIST } from "@/lib/time";
import { TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage() {
  const { weeks, items } = await repo.getTopicsOverview();

  if (!items.length) {
    return (
      <div>
        <PageHeader title="Topics" subtitle="Themes across the shows you monitor, week by week." />
        <ExploreTabs active="Topics" />
        <EmptyState icon={<Hash size={20} />} title="No topics yet" when="Topics appear after the first episodes are analysed, then build up week by week.">
          Each episode is tagged with 3 to 6 specific themes. We chart how often each one appears.
        </EmptyState>
      </div>
    );
  }

  const series = items.slice(0, 5).map((t) => ({ name: t.label, values: t.weekly }));
  const maxCell = Math.max(1, ...items.flatMap((t) => t.weekly));

  return (
    <div>
      <PageHeader title="Topics" subtitle="Episodes per week by theme. The top 5 are charted; everything is in the table below." />
      <ExploreTabs active="Topics" />

      <section aria-labelledby="chart-h" className="mb-8 rounded-panel border border-border bg-surface p-4 sm:p-5">
        <h2 id="chart-h" className="mb-1 text-lg font-semibold">Top topics, last 12 weeks</h2>
        <WeeklyChart weeks={weeks} series={series} kind="line" label="Episodes per week for the five most covered topics" />
      </section>

      <section aria-labelledby="heat-h">
        <h2 id="heat-h" className="mb-3 text-lg font-semibold">All topics</h2>
        <div className="overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">Episodes per week for every topic, darker cells mean more episodes</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="sticky left-0 bg-surface px-4 py-3 text-left font-medium">Topic</th>
                {weeks.map((w) => (
                  <th key={w} scope="col" className="num px-1 py-3 text-center font-normal">{formatIST(startOfDayIST(w), "day")}</th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky left-0 bg-surface px-4 py-2 text-left font-normal">
                    <Link href={`/dashboard/topics/${t.id}`} className="font-medium hover:underline">{t.label}</Link>
                    {t.rising ? <span className="ml-2 align-middle"><Chip tone="success" icon={<TrendingUp size={12} />}>Rising</Chip></span> : null}
                  </th>
                  {t.weekly.map((n, i) => (
                    <td key={i} className="num p-0.5 text-center">
                      <div
                        className="flex h-8 items-center justify-center rounded-[4px] text-xs"
                        style={{ background: n ? `color-mix(in srgb, var(--accent) calc(8% + ${(n / maxCell).toFixed(3)} * var(--heat-span)), transparent)` : undefined }}
                      >
                        {n || <span className="text-muted">0</span>}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right"><Sparkline data={t.weekly} width={72} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
