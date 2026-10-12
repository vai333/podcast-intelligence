"use client";

import { FlaskConical } from "lucide-react";
import { useTransition } from "react";
import { setScenarioAction } from "@/app/dashboard/actions";
import type { MockScenario } from "@/lib/data/types";

const OPTIONS: { value: MockScenario; label: string }[] = [
  { value: "full", label: "12 weeks of history" },
  { value: "first-week", label: "First week only" },
  { value: "empty", label: "Brand new, no data" },
];

/** Mock-only control for reviewing empty and first-run states. Disappears with the real backend. */
export function ScenarioSwitcher({ current }: { current: MockScenario }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <FlaskConical size={14} aria-hidden />
      <span className="hidden sm:inline">Sample data:</span>
      <select
        aria-label="Sample data scenario"
        value={current}
        disabled={pending}
        onChange={(e) => start(() => setScenarioAction(e.target.value as MockScenario))}
        className="h-8 min-w-0 max-w-[10.5rem] truncate rounded-chip border border-border bg-surface px-2 text-xs text-fg sm:max-w-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => start(() => setScenarioAction("reset"))}
        className="hidden h-8 rounded-chip px-2 text-xs underline-offset-2 hover:underline sm:inline"
      >
        Reset
      </button>
    </label>
  );
}
