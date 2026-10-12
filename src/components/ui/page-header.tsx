import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
  /** Small orange label above the title. */
  eyebrow?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {back ? <div className="mb-2 text-sm">{back}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
          <h1 className="text-[30px] font-bold leading-9 tracking-tight">{title}</h1>
          {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
