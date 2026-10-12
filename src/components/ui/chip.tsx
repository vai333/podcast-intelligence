import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "success" | "warn" | "danger" | "info" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg",
  accent: "bg-accent-soft text-accent-soft-fg",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  outline: "border border-border text-muted",
};

/** Small status pill. Status is never colour alone: always pair with an icon and/or text. */
export function Chip({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4",
        tones[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}
