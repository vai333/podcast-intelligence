import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Shown as the card title on mobile (first column by default). */
  primary?: boolean;
  /** URL sort key. When set, the header becomes a sort link. */
  sort?: string;
  numeric?: boolean;
  /** Hide this column in the stacked mobile layout. */
  hideOnMobile?: boolean;
  /** Header is visually hidden (e.g. an actions column) but still announced. */
  srOnlyHeader?: boolean;
}

/**
 * Server-rendered table. Sorting/filtering is URL-driven (pass `sortHref` + `activeSort`).
 * Below `md` each row becomes a stacked card so nothing needs horizontal scrolling.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  sortHref,
  activeSort,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  sortHref?: (sort: string) => string;
  activeSort?: string;
  empty?: React.ReactNode;
}) {
  if (!rows.length && empty) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];

  return (
    <div className="rounded-panel border border-border bg-surface">
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3", c.numeric && "text-right", c.className)}>
                {c.sort && sortHref ? (
                  <Link href={sortHref(c.sort)} className="inline-flex items-center gap-1 hover:text-fg" aria-label={`Sort by ${c.header}`}>
                    {c.header}
                    {activeSort === c.sort ? <ArrowDown size={12} aria-hidden /> : null}
                  </Link>
                ) : c.srOnlyHeader ? (
                  <span className="sr-only">{c.header}</span>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-border last:border-0 hover:bg-surface-2/60">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-top", c.numeric && "num text-right", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)} className="space-y-2 p-4">
            <div className="font-medium">{primary.render(r)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {columns
                .filter((c) => c !== primary && !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className={cn("text-xs text-muted", c.srOnlyHeader && "sr-only")}>{c.header}</dt>
                    <dd className={cn(c.numeric && "num")}>{c.render(r)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
