import { CircleAlert, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatTile } from "@/components/data/stat-tile";
import { RetryFailedButton, RunWorkerButton, SendBriefButtons } from "@/components/system/system-actions";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { repo } from "@/lib/data";
import type { LogEntry } from "@/lib/data/types";
import { formatCompact, formatIST, formatWeekOf, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "System" };

const LEVELS: { value: LogEntry["level"] | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "error", label: "Errors" },
  { value: "warn", label: "Warnings" },
  { value: "info", label: "Info" },
];

const levelChip = { error: "danger", warn: "warn", info: "neutral" } as const;

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const { level: lv } = await searchParams;
  const level = (["error", "warn", "info"] as const).find((l) => l === lv);
  const [sys, logs, meta] = await Promise.all([repo.getSystemStatus(), repo.getLogs({ level }), repo.meta()]);
  const ok = sys.verdict === "ok";
  const pct = Math.round((sys.quota.youtubeUnitsUsed / sys.quota.youtubeUnitsLimit) * 100);

  return (
    <div>
      <PageHeader
        title="System"
        subtitle="Health of the nightly worker, the queue and the weekly email."
        actions={
          <>
            <RunWorkerButton running={sys.worker.state === "running"} />
            <SendBriefButtons weekLabel={sys.latestBriefWeek ? formatWeekOf(sys.latestBriefWeek) : null} sent={sys.latestBriefSent} recipients={sys.recipients} />
          </>
        }
      />

      <div
        role="status"
        className={cn(
          "mb-6 flex items-start gap-3 rounded-panel border p-4",
          ok ? "border-success/30 bg-success-soft text-success" : "border-warn/30 bg-warn-soft text-warn",
        )}
      >
        {ok ? <CircleCheck size={20} aria-hidden className="mt-0.5 shrink-0" /> : <CircleAlert size={20} aria-hidden className="mt-0.5 shrink-0" />}
        <div>
          <p className="font-semibold">{ok ? "Everything is working" : "Needs a look"}</p>
          <p className="text-sm">
            {sys.verdictText}{" "}
            {sys.worker.lastRunAt ? (
              <>Last worker run <span className="num">{relativeTime(sys.worker.lastRunAt, meta.now)}</span>.</>
            ) : (
              "The worker has not run yet. It runs every night, or press Run worker now."
            )}
          </p>
        </div>
      </div>

      <section aria-labelledby="q-h" className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="q-h" className="text-lg font-semibold">Queue</h2>
          <RetryFailedButton count={sys.queue.failed} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Pending" value={sys.queue.pending} />
          <StatTile label="Running" value={sys.queue.running} />
          <StatTile label="Done" value={sys.queue.done} tone="success" />
          <StatTile label="Failed" value={sys.queue.failed} tone={sys.queue.failed ? "danger" : "neutral"} hint={sys.queue.failed ? "Tried twice, then moved on" : undefined} />
          <StatTile label="Skipped" value={sys.queue.skipped} hint="Too long or too short" />
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="c-h">
          <h2 id="c-h" className="mb-3 text-lg font-semibold">Scheduled runs</h2>
          <ul className="divide-y divide-border rounded-panel border border-border bg-surface">
            {sys.cron.map((c) => (
              <li key={c.name} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted">{c.schedule}</p>
                  <p className="mt-1 text-sm text-muted">{c.summary}</p>
                </div>
                <div className="text-right">
                  {c.outcome ? (
                    <Chip tone={c.outcome === "ok" ? "success" : c.outcome === "partial" ? "warn" : "danger"}>
                      {c.outcome === "ok" ? "Succeeded" : c.outcome === "partial" ? "Partly failed" : "Failed"}
                    </Chip>
                  ) : (
                    <Chip tone="outline">Not run yet</Chip>
                  )}
                  {c.lastRunAt ? <p className="num mt-1 text-xs text-muted">{formatIST(c.lastRunAt, "daytime")}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="qt-h">
          <h2 id="qt-h" className="mb-3 text-lg font-semibold">Usage and limits</h2>
          <div className="space-y-4 rounded-panel border border-border bg-surface p-4 text-sm">
            <div>
              <div className="flex justify-between"><span>YouTube quota today</span><span className="num text-muted">{formatCompact(sys.quota.youtubeUnitsUsed)} of {formatCompact(sys.quota.youtubeUnitsLimit)} units</span></div>
              <div role="meter" aria-label="YouTube quota used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="flex justify-between"><span>Episodes analysed today</span><span className="num text-muted">{sys.quota.geminiEpisodesToday} of {sys.quota.geminiEpisodesLimit}</span></div>
            <div className="flex justify-between"><span>AI tokens this week</span><span className="num text-muted">about {formatCompact(sys.quota.weeklyTokens)}</span></div>
            <p className="border-t border-border pt-3 text-xs text-muted">
              Estimates. Discovery pauses if YouTube quota runs low, and extraction waits until tomorrow when the daily episode limit is reached.
            </p>
          </div>
        </section>
      </div>

      <section aria-labelledby="l-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="l-h" className="text-lg font-semibold">Log</h2>
          <nav aria-label="Filter log" className="inline-flex rounded-chip border border-border bg-surface p-1">
            {LEVELS.map((l) => (
              <Link
                key={l.label}
                href={l.value ? `/dashboard/system?level=${l.value}` : "/dashboard/system"}
                aria-current={(level ?? "") === l.value ? "true" : undefined}
                className={cn("min-h-[32px] rounded-[4px] px-3 py-1 text-sm font-medium", (level ?? "") === l.value ? "bg-accent-soft text-accent-soft-fg" : "text-muted hover:text-fg")}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <ul className="divide-y divide-border rounded-panel border border-border bg-surface">
          {logs.length ? (
            logs.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:gap-4">
                <span className="num w-36 shrink-0 text-xs text-muted">{formatIST(l.at, "daytime")}</span>
                <span className="w-20 shrink-0"><Chip tone={levelChip[l.level]}>{l.level === "error" ? "Error" : l.level === "warn" ? "Warning" : "Info"}</Chip></span>
                <span className="min-w-0 flex-1">
                  {l.message}
                  {l.refLabel ? <span className="ml-2 text-xs text-muted">{l.refLabel}</span> : null}
                </span>
                <span className="font-mono text-xs text-muted">{l.scope}</span>
              </li>
            ))
          ) : (
            <li className="px-4 py-8 text-center text-sm text-muted">Nothing logged at this level.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
