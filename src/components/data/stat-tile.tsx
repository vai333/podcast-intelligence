import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "danger" | "success" | "warn";
  className?: string;
}) {
  return (
    <div className={cn("rounded-panel border border-border bg-surface p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "num mt-1 text-[32px] font-semibold leading-[38px]",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
