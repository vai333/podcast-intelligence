import { cn } from "@/lib/utils";

// One ECG cycle (P wave, QRS spike, T wave) drawn with smooth curves, repeated three times across the line.
const cycle = (x: number) =>
  `L${x} 20 C${x + 8} 20 ${x + 10} 14 ${x + 18} 14 S${x + 26} 20 ${x + 34} 20 L${x + 42} 20 L${x + 48} 24 L${x + 55} 3 L${x + 62} 34 L${x + 68} 20 L${x + 76} 20 C${x + 90} 20 ${x + 94} 11 ${x + 108} 11 S${x + 120} 20 ${x + 134} 20`;
const TRACE = `M0 20 ${cycle(30)} ${cycle(230)} ${cycle(430)} L600 20`;

function Trace({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 600 40" aria-hidden className={cn("absolute inset-0 h-full w-full", className)}>
      <path d={TRACE} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "We are watching" indicator: a live heartbeat line with a status label. Decorative; the text carries the meaning. */
export function MonitorPulse({ shows, className }: { shows?: number; className?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-[560px] flex-col items-center", className)}>
      <div className="monitor relative aspect-[15/1] w-full">
        <Trace className="monitor-base" />
        <Trace className="monitor-glow" />
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs font-medium text-muted" role="status">
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-accent" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        Monitoring{shows ? ` ${shows} shows` : " your shows"} · checked every night
      </p>
    </div>
  );
}
