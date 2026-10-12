import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/** Row-shaped skeleton that matches RankRow so the page does not jump when data arrives. */
export function RowSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-border rounded-panel border border-border bg-surface">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-4 p-4">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  when,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  /** When will something appear here? Always tell the user. */
  when?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-panel border border-dashed border-border bg-surface px-5 py-8 text-center", className)}>
      {icon ? <div aria-hidden className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {children ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p> : null}
      {when ? <p className="mx-auto mt-2 max-w-md text-sm text-muted"><span className="font-medium text-fg">When: </span>{when}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorPanel({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-panel border border-danger/30 bg-danger-soft p-4 text-danger">
      <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? <p className="mt-0.5 text-sm">{children}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
