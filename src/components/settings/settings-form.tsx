"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Settings } from "@/lib/data/types";

const FIELDS = [
  { key: "maxActiveShows", label: "Maximum monitored shows", hint: "The most shows you can have active at once.", min: 1, max: 25 },
  { key: "minEpisodeMinutes", label: "Shortest episode to analyse (minutes)", hint: "Anything shorter is skipped, which filters out Shorts and clips.", min: 1, max: 600 },
  { key: "maxEpisodeMinutes", label: "Longest episode to analyse (minutes)", hint: "Anything longer is skipped to keep AI cost predictable.", min: 1, max: 600 },
  { key: "trendLookbackDays", label: "Trend lookback (days)", hint: "How far back we look when checking if a guest or topic is on several shows.", min: 7, max: 90 },
] as const;

export function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState({
    maxActiveShows: String(initial.maxActiveShows),
    minEpisodeMinutes: String(initial.minEpisodeMinutes),
    maxEpisodeMinutes: String(initial.maxEpisodeMinutes),
    trendLookbackDays: String(initial.trendLookbackDays),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      maxActiveShows: Number(values.maxActiveShows),
      minEpisodeMinutes: Number(values.minEpisodeMinutes),
      maxEpisodeMinutes: Number(values.maxEpisodeMinutes),
      trendLookbackDays: Number(values.trendLookbackDays),
      adminEmail: initial.adminEmail,
    };
    const parsed = Settings.safeParse(next);
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      for (const f of FIELDS) {
        const n = next[f.key];
        if (!Number.isInteger(n) || n < f.min || n > f.max) errs[f.key] = `Enter a whole number from ${f.min} to ${f.max}.`;
      }
    } else if (next.minEpisodeMinutes >= next.maxEpisodeMinutes) {
      errs.minEpisodeMinutes = "Must be shorter than the longest episode.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    start(async () => {
      const r = await saveSettingsAction(next);
      toast.push(r.message, r.ok ? "success" : "danger");
    });
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-5">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className="block text-sm font-medium">{f.label}</label>
          <p id={`${f.key}-hint`} className="mb-1.5 text-xs text-muted">{f.hint}</p>
          <input
            id={f.key}
            inputMode="numeric"
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            aria-describedby={`${f.key}-hint${errors[f.key] ? ` ${f.key}-err` : ""}`}
            aria-invalid={errors[f.key] ? true : undefined}
            className="num h-10 w-32 rounded-chip border border-border bg-surface px-3 text-sm aria-[invalid=true]:border-danger"
          />
          {errors[f.key] ? <p id={`${f.key}-err`} role="alert" className="mt-1 text-xs text-danger">{errors[f.key]}</p> : null}
        </div>
      ))}
      <div>
        <p className="text-sm font-medium">Weekly brief is emailed to</p>
        <p className="mt-1 text-sm text-muted">{initial.adminEmail}</p>
        <p className="text-xs text-muted">Set with BRIEF_RECIPIENTS in the server settings.</p>
      </div>
      <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>
    </form>
  );
}
