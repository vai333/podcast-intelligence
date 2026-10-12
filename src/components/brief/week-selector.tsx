"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WeekOption {
  value: string; // week start
  label: string; // "5 to 11 Oct"
}

/** Prev / next arrows plus a dropdown for jumping. The latest week lives at /dashboard. */
export function WeekSelector({
  current,
  prev,
  next,
  latest,
  options,
  section,
}: {
  current: string;
  prev: string | null;
  next: string | null;
  latest: string;
  options: WeekOption[];
  /** When set, every link stays on that section (guests | topics | sponsors) of the chosen week. */
  section?: string;
}) {
  const router = useRouter();
  const href = (w: string) => (section ? `/dashboard/briefs/${w}/${section}` : w === latest ? "/dashboard" : `/dashboard/briefs/${w}`);
  const arrow = (to: string | null, label: string, icon: React.ReactNode) =>
    to ? (
      <Link href={href(to)} aria-label={label} className={cn(buttonClass("secondary", "md"), "w-10 px-0")}>
        {icon}
      </Link>
    ) : (
      <span aria-hidden className={cn(buttonClass("secondary", "md"), "w-10 px-0 opacity-40")}>
        {icon}
      </span>
    );

  return (
    <div className="flex items-center gap-1.5">
      {arrow(prev, "Previous week", <ChevronLeft size={18} aria-hidden />)}
      <label className="sr-only" htmlFor="week-select">
        Choose week
      </label>
      <select
        id="week-select"
        value={current}
        onChange={(e) => router.push(href(e.target.value))}
        className="h-10 min-w-[150px] rounded-chip border border-border bg-surface px-3 text-sm font-medium"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {arrow(next, "Next week", <ChevronRight size={18} aria-hidden />)}
    </div>
  );
}
