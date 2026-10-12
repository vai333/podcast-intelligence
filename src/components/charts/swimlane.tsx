import type { EpisodeRef } from "@/lib/data/types";
import { formatCompact, formatIST } from "@/lib/time";

const DAY = 86_400_000;

/**
 * One guest across shows: a row per show, a dot per episode, dot size = views.
 * Makes a media round visible at a glance. Server-rendered SVG, scales to any width.
 * Pair it with the appearances table below it (the accessible equivalent).
 */
export function Swimlane({
  episodes,
  lanes,
  now,
  days = 30,
}: {
  episodes: EpisodeRef[];
  lanes: { showId: string; showName: string }[];
  now: string;
  days?: number;
}) {
  const end = new Date(now).getTime();
  const start = end - days * DAY;
  const W = 720;
  const labelW = 150;
  const rowH = 44;
  const top = 8;
  const H = top + lanes.length * rowH + 26;
  const x = (t: number) => labelW + ((t - start) / (end - start)) * (W - labelW - 12);
  const maxViews = Math.max(1, ...episodes.map((e) => e.views ?? 0));
  const r = (v: number | null) => (v === null ? 5 : 5 + Math.sqrt(v / maxViews) * 8);
  const ticks = [0, 10, 20, 30].filter((d) => d <= days);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Appearances over the last ${days} days across ${lanes.length} shows`}>
      {lanes.map((l, i) => {
        const y = top + i * rowH + rowH / 2;
        return (
          <g key={l.showId}>
            <line x1={labelW} x2={W - 12} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={0} y={y + 4} fontSize={12} fill="var(--fg)">
              {l.showName.length > 22 ? `${l.showName.slice(0, 21)}…` : l.showName}
            </text>
          </g>
        );
      })}
      {ticks.map((d) => {
        const t = end - (days - d) * DAY;
        return (
          <g key={d}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={top + lanes.length * rowH} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={x(t)} y={H - 6} fontSize={11} fill="var(--fg-muted)" textAnchor={d === 0 ? "start" : d === days ? "end" : "middle"}>
              {formatIST(t, "day")}
            </text>
          </g>
        );
      })}
      {episodes
        .filter((e) => new Date(e.publishedAt).getTime() >= start)
        .map((e) => {
          const lane = lanes.findIndex((l) => l.showId === e.showId);
          if (lane < 0) return null;
          const cx = x(new Date(e.publishedAt).getTime());
          const cy = top + lane * rowH + rowH / 2;
          return (
            <g key={e.episodeId}>
              <title>{`${e.showName}: ${e.title} (${formatIST(e.publishedAt, "day")}${e.views !== null ? `, ${formatCompact(e.views)} views` : ""})`}</title>
              <circle cx={cx} cy={cy} r={r(e.views)} fill="var(--chart-1)" fillOpacity={0.85} stroke="var(--surface)" strokeWidth={2} />
            </g>
          );
        })}
    </svg>
  );
}
