import { Info, Repeat, Sparkles, TrendingUp, Eye, Sprout, RotateCcw } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Tip } from "@/components/ui/tooltip";
import type { Heat, Placement } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const HEAT: Record<Heat, { label: string; bars: number }> = {
  strong: { label: "Strong signal", bars: 3 },
  medium: { label: "Medium signal", bars: 2 },
  emerging: { label: "Emerging", bars: 1 },
};

/** Three-bar meter plus text. The text carries the meaning; the bars are decoration. */
export function HeatLabel({ heat, className }: { heat: Heat; className?: string }) {
  const h = HEAT[heat];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted", className)}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-1 rounded-sm", i <= h.bars ? "bg-accent" : "bg-border")}
            style={{ height: 4 + i * 3 }}
          />
        ))}
      </span>
      {h.label}
    </span>
  );
}

export function MediaRoundBadge({ shows, days }: { shows: number; days: number }) {
  return (
    <Chip tone="accent" icon={<Repeat size={12} />} title="Appearing on several shows in a short period usually means a media round, so they are likely bookable.">
      Media round: {shows} shows in {Math.max(days, 1)} {days <= 1 ? "day" : "days"}
    </Chip>
  );
}

export function TopViewsBadge({ percentile }: { percentile: number }) {
  return (
    <Chip tone="info" icon={<Eye size={12} />}>
      Top {Math.max(100 - percentile, 1)}% by views
    </Chip>
  );
}

export function RisingBadge({ thisWeek, prevAvg }: { thisWeek: number; prevAvg: number }) {
  return (
    <Chip tone="success" icon={<TrendingUp size={12} />}>
      Rising: {thisWeek} this week vs {prevAvg} avg
    </Chip>
  );
}

export function NewBadge() {
  return (
    <Chip tone="success" icon={<Sprout size={12} />}>
      New
    </Chip>
  );
}

export function ReturningBadge() {
  return (
    <Chip tone="neutral" icon={<RotateCcw size={12} />}>
      Returning
    </Chip>
  );
}

/** Neutral, not an error: it just tells the reader how the episode was analysed. */
export function MetadataOnlyBadge() {
  return (
    <Tip content="Analysed from the title and description only. Guests and sponsors that are only spoken in the episode may be missing.">
      <span tabIndex={0} className="inline-flex">
        <Chip tone="outline" icon={<Info size={12} />}>
          Metadata only
        </Chip>
      </span>
    </Tip>
  );
}

/** Marks text written by the model, so it is never mistaken for a computed fact. */
export function AiTag({ children = "AI suggestion" }: { children?: React.ReactNode }) {
  return (
    <Chip tone="outline" icon={<Sparkles size={12} />}>
      {children}
    </Chip>
  );
}

export const PLACEMENT_LABEL: Record<Placement, string> = {
  host_read: "Host read",
  pre_roll: "Pre-roll",
  mid_roll: "Mid-roll",
  post_roll: "Post-roll",
  description_link: "Description link",
  on_screen: "On screen",
  unknown: "Placement unknown",
};
