"use client";

import { ArrowLeftRight, Headphones, Info, Minus, Play, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { readdShowAction, removeShowAction } from "@/app/dashboard/actions";
import { ShowAvatar } from "@/components/data/show-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { Lineup, Show } from "@/lib/data/types";
import { formatCompact, formatIST, relativeDays } from "@/lib/time";
import { ShowSheet, type SheetState } from "./show-sheet";

function Health({ s }: { s: Show }) {
  if (s.health === "error") return <Chip tone="danger" title={s.healthNote ?? undefined}>Needs attention</Chip>;
  if (s.health === "quiet") return <Chip tone="warn" title={s.healthNote ?? undefined}>Quiet</Chip>;
  return <Chip tone="success">Healthy</Chip>;
}

export function ShowsManager({ lineup }: { lineup: Lineup }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const { active, past, maxActive, now } = lineup;
  const atCap = active.length >= maxActive;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="num text-lg font-semibold">{active.length}</span>
          <span className="text-muted"> of <span className="num">{maxActive}</span> shows monitored</span>
        </p>
        <div className="flex items-center gap-3">
          {atCap ? <span className="text-xs text-muted">At the limit. Swap or remove one to add another.</span> : null}
          <Button variant="primary" disabled={atCap} onClick={() => setSheet({ mode: "add" })}>
            <Plus size={16} aria-hidden /> Add show
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-panel border border-border bg-surface">
        {active.map((s) => {
          const since = s.intervals[s.intervals.length - 1]?.from;
          return (
            <li key={s.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <ShowAvatar name={s.name} size={44} />
                <div className="min-w-0">
                  <p className="font-semibold leading-5">{s.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {s.youtube ? <Chip tone="neutral" icon={<Play size={12} />}>YouTube <span className="num">{formatCompact(s.youtube.subscribers)}</span></Chip> : null}
                    {s.spotify ? <Chip tone="neutral" icon={<Headphones size={12} />}>Spotify</Chip> : null}
                    {!s.youtube ? <Chip tone="info" icon={<Info size={12} />} title="No YouTube channel: analysed from title and description only, no view counts.">Metadata-only analysis</Chip> : null}
                    <Health s={s} />
                  </div>
                  {s.healthNote ? <p className="mt-1.5 text-xs text-muted">{s.healthNote}</p> : null}
                </div>
              </div>
              <div className="num text-xs text-muted lg:w-52">
                <p>Monitored since {since ? formatIST(since, "day") : "n/a"}</p>
                <p>{s.episodes30d} episodes in 30 days{s.lastEpisodeAt ? `, last ${relativeDays(s.lastEpisodeAt, now)}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSheet({ mode: "swap", outgoingId: s.id })}>
                  <ArrowLeftRight size={14} aria-hidden /> Swap
                </Button>
                <ConfirmDialog
                  tone="danger"
                  trigger={<Button size="sm" variant="secondary"><Minus size={14} aria-hidden /> Remove</Button>}
                  title={`Remove ${s.name}?`}
                  impact={[
                    { label: "Effective now", text: `${formatIST(now, "full")}.` },
                    { label: "History kept", text: `Its ${s.pastEpisodeCount} episodes, guests, topics and sponsors stay in your archive and in past briefs.` },
                    { label: "Trends", text: "It stops counting toward new trends from this moment." },
                    { label: "Undo", text: "You can re-add it later from Past shows. That starts a new tracking period with no backfill." },
                  ]}
                  confirmLabel="Remove show"
                  onConfirm={() => removeShowAction(s.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {past.length ? (
        <section aria-labelledby="past-h" className="mt-8">
          <h2 id="past-h" className="mb-1 text-lg font-semibold">Past shows</h2>
          <p className="mb-3 text-sm text-muted">Nothing is ever deleted. These shows are no longer monitored, but everything they produced is kept.</p>
          <ul className="divide-y divide-border rounded-panel border border-border bg-surface">
            {past.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <ShowAvatar name={s.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="num text-xs text-muted">
                    {s.pastEpisodeCount} episodes kept · stopped {s.intervals[s.intervals.length - 1]?.to ? formatIST(s.intervals[s.intervals.length - 1].to as string, "day") : ""}
                  </p>
                </div>
                <ConfirmDialog
                  trigger={<Button size="sm" variant="secondary" disabled={atCap}><RotateCcw size={14} aria-hidden /> Re-add</Button>}
                  title={`Re-add ${s.name}?`}
                  impact={[
                    { label: "Effective now", text: `${formatIST(now, "full")}.` },
                    { label: "New tracking period", text: "Episodes published while it was not monitored are not imported." },
                    { label: "History", text: "The earlier period and everything from it stay as they were." },
                  ]}
                  confirmLabel="Re-add show"
                  onConfirm={() => readdShowAction(s.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ShowSheet state={sheet} onClose={() => setSheet(null)} active={active} maxActive={maxActive} nowIso={now} />
    </>
  );
}
