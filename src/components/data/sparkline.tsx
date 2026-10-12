import { cn } from "@/lib/utils";

/** Tiny dependency-free trend line. Decorative: always pair it with the numbers in text. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  label,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {last ? <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--chart-1)" /> : null}
    </svg>
  );
}
