"use client";

import { Check, Headphones, Info, Link2Off, Play, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { addShowAction, searchShowsAction, swapShowAction } from "@/app/dashboard/actions";
import { ShowAvatar } from "@/components/data/show-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import type { Show, ShowCandidate } from "@/lib/data/types";
import { formatCompact, formatIST, relativeDays } from "@/lib/time";
import { cn } from "@/lib/utils";

export type SheetState = { mode: "swap"; outgoingId?: string } | { mode: "add" } | null;

const STEPS = { swap: ["Search", "Pair", "Replace"], add: ["Search", "Pair"] } as const;

function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
          <span
            className={cn(
              "num flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              i < current ? "bg-success-soft text-success" : i === current ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            {i < current ? <Check size={12} aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-semibold" : "text-muted")}>{s}</span>
          {i < steps.length - 1 ? <span aria-hidden className="mx-1 hidden h-px w-5 bg-border min-[420px]:block" /> : null}
        </li>
      ))}
    </ol>
  );
}

function Slot({ icon, label, children, onClear }: { icon: React.ReactNode; label: string; children: React.ReactNode; onClear?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-chip border border-border p-3">
      <span aria-hidden className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
      {onClear ? <Button size="sm" variant="ghost" onClick={onClear}><Link2Off size={14} aria-hidden /> None</Button> : null}
    </div>
  );
}

export function ShowSheet({
  state,
  onClose,
  active,
  maxActive,
  nowIso,
}: {
  state: SheetState;
  onClose: () => void;
  active: Show[];
  maxActive: number;
  nowIso: string;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      {state ? (
        <DialogContent
          side="right"
          title={state.mode === "swap" ? "Swap a show" : "Add a show"}
          description={state.mode === "swap" ? "Replace one monitored show with another, from this moment on." : `You have ${active.length} of ${maxActive} shows.`}
        >
          <Flow key={state.mode + (state.mode === "swap" ? (state.outgoingId ?? "") : "")} state={state} onDone={onClose} active={active} nowIso={nowIso} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Flow({ state, onDone, active, nowIso }: { state: NonNullable<SheetState>; onDone: () => void; active: Show[]; nowIso: string }) {
  const swap = state.mode === "swap";
  const steps = STEPS[state.mode];
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ShowCandidate[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [candidate, setCandidate] = useState<ShowCandidate | null>(null);
  const [outgoing, setOutgoing] = useState<string | undefined>(state.mode === "swap" ? state.outgoingId : undefined);
  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startSearch(async () => setResults(await searchShowsAction(q)));
  };

  const hasSource = !!candidate && (candidate.youtube || candidate.spotify);
  const spotifyOnly = !!candidate && !candidate.youtube && !!candidate.spotify;
  const quietest = [...active].sort((a, b) => a.episodes30d - b.episodes30d)[0];
  const out = active.find((s) => s.id === outgoing);

  return (
    <div>
      <Stepper steps={steps} current={step} />

      {step === 0 ? (
        <div>
          <form onSubmit={runSearch} role="search" className="flex gap-2">
            <label htmlFor="show-q" className="sr-only">Search podcasts</label>
            <input
              id="show-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, or YouTube / Spotify link"
              className="h-10 min-w-0 flex-1 rounded-chip border border-border bg-surface px-3 text-sm placeholder:text-muted"
              autoFocus
            />
            <Button type="submit" variant="primary" disabled={searching || !q.trim()}>
              <Search size={16} aria-hidden /> {searching ? "Searching..." : "Search"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted">Try &ldquo;chai&rdquo;, &ldquo;capital&rdquo;, &ldquo;saathi&rdquo;, or paste a link.</p>

          {results ? (
            results.length ? (
              <ul className="mt-4 space-y-2" aria-label="Search results">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setCandidate(c); setStep(1); }}
                      className="flex w-full items-start gap-3 rounded-panel border border-border p-3 text-left hover:bg-surface-2"
                    >
                      <ShowAvatar name={c.name} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{c.name}</span>
                        <span className="block text-sm text-muted">{c.description}</span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.youtube ? <Chip tone="neutral" icon={<Play size={12} />}>YouTube {formatCompact(c.youtube.subscribers)}</Chip> : null}
                          {c.spotify ? <Chip tone="neutral" icon={<Headphones size={12} />}>Spotify</Chip> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-panel border border-dashed border-border p-4 text-sm text-muted">
                No match for &ldquo;{q}&rdquo;. Check the spelling, or paste a YouTube channel link or Spotify show link instead.
              </p>
            )
          ) : null}
        </div>
      ) : null}

      {step === 1 && candidate ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ShowAvatar name={candidate.name} size={48} />
            <div>
              <p className="text-lg font-semibold">{candidate.name}</p>
              <p className="text-sm text-muted">{candidate.description}</p>
            </div>
          </div>
          <p
            className={cn(
              "flex items-start gap-2 rounded-chip px-3 py-2 text-sm",
              candidate.matchConfidence === "high" ? "bg-success-soft text-success" : "bg-warn-soft text-warn",
            )}
          >
            <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
            {candidate.matchNote}
          </p>
          <Slot icon={<Play size={16} />} label="YouTube channel" onClear={candidate.youtube ? () => setCandidate({ ...candidate, youtube: null }) : undefined}>
            {candidate.youtube ? <>{candidate.youtube.handle} · <span className="num">{formatCompact(candidate.youtube.subscribers)}</span> subscribers</> : <span className="text-muted">Not linked</span>}
          </Slot>
          {candidate.spotify ? (
            <Slot icon={<Headphones size={16} />} label="Spotify show" onClear={() => setCandidate({ ...candidate, spotify: null })}>{candidate.spotify.publisher}</Slot>
          ) : null}
          {spotifyOnly ? (
            <p className="flex items-start gap-2 rounded-chip bg-info-soft px-3 py-2 text-sm text-info">
              <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
              Spotify only: episodes will be analysed from the title and description only, and there are no view counts.
            </p>
          ) : null}
          {!hasSource ? <p className="text-sm text-danger">A show needs at least a YouTube channel or a Spotify show to be monitored.</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            {swap ? (
              <Button variant="primary" disabled={!hasSource} onClick={() => setStep(2)}>Next: pick show to replace</Button>
            ) : (
              <ConfirmDialog
                trigger={<Button variant="primary" disabled={!hasSource}>Review and add</Button>}
                title={`Add ${candidate.name}?`}
                impact={[
                  { label: "Effective now", text: `${formatIST(nowIso, "full")}.` },
                  { label: "No backfill", text: `${candidate.name} is tracked from this moment. Earlier episodes are never imported.` },
                  { label: "Brief history", text: "Past briefs stay exactly as they were sent." },
                ]}
                confirmLabel="Add show"
                onConfirm={async () => {
                  const r = await addShowAction(candidate);
                  if (r.ok) onDone();
                  return r;
                }}
              />
            )}
          </div>
        </div>
      ) : null}

      {step === 2 && candidate && swap ? (
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Which show should {candidate.name} replace?</legend>
            <div className="space-y-2">
              {active.map((s) => (
                <label key={s.id} className={cn("flex cursor-pointer items-center gap-3 rounded-panel border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft", outgoing === s.id ? "border-accent" : "border-border")}>
                  <input type="radio" name="outgoing" value={s.id} checked={outgoing === s.id} onChange={() => setOutgoing(s.id)} className="h-4 w-4 accent-[var(--accent)]" />
                  <ShowAvatar name={s.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="num block text-xs text-muted">
                      {s.episodes30d} episodes in 30 days{s.lastEpisodeAt ? `, last ${relativeDays(s.lastEpisodeAt, nowIso)}` : ""}
                    </span>
                  </span>
                  {quietest?.id === s.id ? <Chip tone="outline">Quietest</Chip> : null}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <ConfirmDialog
              trigger={<Button variant="primary" disabled={!out}>Review swap</Button>}
              title={out ? `Replace ${out.name} with ${candidate.name}?` : "Replace show?"}
              impact={[
                { label: "Effective now", text: `${formatIST(nowIso, "full")}.` },
                { label: "No backfill", text: `${candidate.name} is tracked from this moment. Earlier episodes are never imported.` },
                { label: "History kept", text: `${out?.name ?? "The old show"}'s ${out?.pastEpisodeCount ?? 0} episodes, guests, topics and sponsors stay in your archive and in past briefs. It simply stops counting toward new trends.` },
                { label: "Past briefs are frozen", text: "Nothing you have already been sent will change." },
              ]}
              confirmLabel="Replace show"
              onConfirm={async () => {
                if (!outgoing) return { ok: false, message: "Choose which show to replace." };
                const r = await swapShowAction(outgoing, candidate);
                if (r.ok) onDone();
                return r;
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
