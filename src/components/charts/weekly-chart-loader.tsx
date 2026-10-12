"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/states";

/** Loads Recharts only on pages that need it, in a fixed-height box so nothing shifts when it arrives. */
const WeeklyChart = dynamic(() => import("./weekly-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

export { WeeklyChart };
export type { Series } from "./weekly-chart";
