import Link from "next/link";
import { cn } from "@/lib/utils";
import { EXPLORE_TABS } from "./nav-config";

/** Segmented switch shared by Guests / Topics / Sponsors (this is what "Explore" opens on mobile). */
export function ExploreTabs({ active }: { active: "Guests" | "Topics" | "Sponsors" }) {
  return (
    <nav aria-label="Explore" className="mb-5 inline-flex rounded-chip border border-border bg-surface p-1">
      {EXPLORE_TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.label === active ? "page" : undefined}
          className={cn(
            "min-h-[36px] rounded-[4px] px-4 py-1.5 text-sm font-medium",
            t.label === active ? "bg-accent-soft text-accent-soft-fg" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
