import { Minus, Plus } from "lucide-react";
import type { Lineup } from "@/lib/data/types";
import { formatIST } from "@/lib/time";

const DAY = 86_400_000;

/**
 * Lineup history: one lane per show over the last 12 weeks, bars = the periods it was monitored.
 * A show that was dropped and later re-added shows two bars. The change list beneath is the
 * accessible equivalent and also the mobile view.
 */
export function Timeline({ lineup }: { lineup: Lineup }) {
  const start = new Date(lineup.windowStart).getTime();
  const end = new Date(lineup.now).getTime();
  const shows = [...lineup.active, ...lineup.past].filter((s) =>
    s.intervals.some((i) => new Date(i.to ?? lineup.now).getTime() > start),
  );
  const W = 900;
  const labelW = 190;
  const rowH = 30;
  const top = 6;
  const H = top + shows.length * rowH + 24;
  const x = (t: number) => labelW + ((Math.max(t, start) - start) / (end - start)) * (W - labelW - 10);
  const weeks = Array.from({ length: 5 }, (_, i) => end - (4 - i) * 3 * 7 * DAY).filter((t) => t >= start && t < end - 5 * DAY);

  return (
    <div>
      <div className="hidden md:block">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Lineup history over the last 12 weeks. A list of changes follows.">
          {weeks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top} y2={top + shows.length * rowH} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={x(t)} y={H - 6} fontSize={11} fill="var(--fg-muted)" textAnchor="middle">{formatIST(t, "day")}</text>
            </g>
          ))}
          {shows.map((s, i) => {
            const y = top + i * rowH;
            return (
              <g key={s.id}>
                <text x={0} y={y + rowH / 2 + 4} fontSize={12} fill={s.active ? "var(--fg)" : "var(--fg-muted)"}>
                  {s.name.length > 27 ? `${s.name.slice(0, 26)}…` : s.name}
                </text>
                {s.intervals.map((iv, k) => {
                  const a = new Date(iv.from).getTime();
                  const b = iv.to ? new Date(iv.to).getTime() : end;
                  if (b < start) return null;
                  return (
                    <rect
                      key={k}
                      x={x(a)}
                      y={y + 7}
                      width={Math.max(x(b) - x(a), 3)}
                      height={rowH - 14}
                      rx={4}
                      fill={s.active ? "var(--chart-1)" : "var(--chart-other)"}
                      fillOpacity={s.active ? 0.9 : 0.6}
                    >
                      <title>{`${s.name}: ${formatIST(iv.from, "day")} to ${iv.to ? formatIST(iv.to, "day") : "now"}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
          <line x1={x(end)} x2={x(end)} y1={top - 2} y2={top + shows.length * rowH} stroke="var(--danger)" strokeWidth={1.5} />
          <text x={x(end)} y={H - 6} fontSize={11} fill="var(--danger)" textAnchor="end">Now</text>
        </svg>
        <p className="mt-1 text-xs text-muted">Blue = currently monitored. Grey = a period that has ended. Two bars on one row means the show was dropped, then re-added.</p>
      </div>

      <h3 className="mb-2 mt-4 text-sm font-semibold">Changes in the last 12 weeks</h3>
      {lineup.changes.length ? (
        <ul className="divide-y divide-border rounded-panel border border-border">
          {lineup.changes.map((c) => (
            <li key={c.at + c.showName + c.kind} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={c.kind === "added" ? "text-success" : "text-muted"} aria-hidden>
                {c.kind === "added" ? <Plus size={16} /> : <Minus size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.showName}</span> {c.kind === "added" ? "added" : "removed"}
              </span>
              <span className="num shrink-0 text-xs text-muted">{formatIST(c.at, "daytime")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No lineup changes in the last 12 weeks.</p>
      )}
    </div>
  );
}
