"use client";

import { Radio as Logo } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isActive } from "./nav-config";

/** Desktop: 232px rail. Tablet (md): collapses to a 64px icon rail. Hidden on mobile (bottom bar instead). */
export function Sidebar({ latestWeek }: { latestWeek: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-border bg-surface md:flex lg:w-[232px]">
      <Link href="/dashboard" className="flex h-14 items-center gap-2.5 border-b border-border px-[18px] font-semibold">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-accent text-accent-fg">
          <Logo size={16} aria-hidden />
        </span>
        <span className="hidden lg:inline">Podcast Intelligence</span>
        <span className="sr-only lg:hidden">Podcast Intelligence home</span>
      </Link>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="mb-1 hidden px-3 text-xs font-medium uppercase tracking-wide text-muted lg:block">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(pathname, item, latestWeek);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.label}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-chip px-3 text-sm font-medium transition-colors",
                        "justify-center lg:justify-start",
                        active ? "bg-accent-soft text-accent-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <Icon size={18} aria-hidden className="shrink-0" />
                      <span className="hidden lg:inline">{item.label}</span>
                      <span className="sr-only lg:hidden">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
