"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { formatIST, startOfDayIST } from "@/lib/time";

export interface Series {
  name: string;
  values: number[];
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const OTHER = "var(--chart-other)";
const DASHES = [undefined, "6 3", "2 3", "8 3 2 3", "1 4"];

const tick = (w: string) => formatIST(startOfDayIST(w), "day");

/**
 * Weekly counts as stacked bars or lines. Max 5 series; extras should be grouped as "Other" by the caller.
 * Colour is never the only cue: lines get dash patterns, and every chart has a "View as table" toggle.
 */
export default function WeeklyChart({
  weeks,
  series,
  kind = "bar",
  height = 280,
  label,
}: {
  weeks: string[];
  series: Series[];
  kind?: "bar" | "line";
  height?: number;
  label: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();
  const data = weeks.map((w, i) => ({ week: tick(w), ...Object.fromEntries(series.map((s) => [s.name, s.values[i] ?? 0])) }));
  const color = (s: Series, i: number) => (s.name === "Other" ? OTHER : COLORS[i % COLORS.length]);

  const axis = { stroke: "var(--fg-muted)", fontSize: 12 } as const;
  const tooltipStyle = {
    contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--fg)" },
    labelStyle: { color: "var(--fg)", fontWeight: 600 },
    itemStyle: { color: "var(--fg)" },
  };

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="ghost" aria-pressed={asTable} aria-controls={tableId} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "View as chart" : "View as table"}
        </Button>
      </div>
      <div id={tableId}>
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">{label}</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Week of</th>
                  {series.map((s) => (
                    <th key={s.name} scope="col" className="num px-2 py-2 text-right font-medium">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, i) => (
                  <tr key={w} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">{tick(w)}</th>
                    {series.map((s) => (
                      <td key={s.name} className="num px-2 py-2 text-right">{s.values[i] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div role="img" aria-label={label} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {kind === "bar" ? (
                <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
                  {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: "var(--fg-muted)" }} /> : null}
                  {series.map((s, i) => (
                    <Bar key={s.name} dataKey={s.name} stackId="a" fill={color(s, i)} isAnimationActive={false} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: "var(--fg-muted)" }} /> : null}
                  {series.map((s, i) => (
                    <Line key={s.name} type="monotone" dataKey={s.name} stroke={color(s, i)} strokeWidth={2} strokeDasharray={DASHES[i % DASHES.length]} dot={{ r: 3 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
