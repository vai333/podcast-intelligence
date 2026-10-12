import { cn } from "@/lib/utils";

/**
 * The reader-mode unit: a ranked row, no card. Rank, headline, badges, one evidence line,
 * an optional in-place disclosure (children), and actions at the end.
 */
export function RankRow({
  rank,
  title,
  subtitle,
  right,
  badges,
  because,
  children,
  actions,
  headingLevel = 2,
}: {
  rank?: number;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  badges?: React.ReactNode;
  because?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  headingLevel?: 2 | 3 | 4;
}) {
  const H = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h4";
  return (
    <li className="flex gap-3 border-t border-border py-5 first:border-t-0 sm:gap-4">
      {rank !== undefined ? (
        <span
          aria-hidden
          className="num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-muted"
        >
          {rank}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <H className="break-words text-lg font-semibold leading-6">
              {rank !== undefined ? <span className="sr-only">{`Number ${rank}: `}</span> : null}
              {title}
            </H>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
          {right}
        </div>
        {badges ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div> : null}
        {because ? <div className="mt-2 text-sm leading-5 text-muted">{because}</div> : null}
        {children ? <div className="mt-3">{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </li>
  );
}

/** Native <details> disclosure: works without JavaScript and is keyboard accessible. */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("group rounded-chip", className)}>
      <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block text-xs transition-transform group-open:rotate-90">▸</span>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
