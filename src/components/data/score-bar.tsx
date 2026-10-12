import { cn } from "@/lib/utils";

/** Horizontal meter with a numeric label. Used inside "Why ranked here" and console tables, not on the brief rows. */
export function ScoreBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="num w-9 text-right text-xs font-medium">{pct}%</span>
    </div>
  );
}
