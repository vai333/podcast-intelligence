"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isActive } from "./nav-config";

const ADMIN = NAV_GROUPS.find((g) => g.label === "Admin")?.items ?? [];
const PRIMARY = NAV_GROUPS.filter((g) => g.label !== "Admin").flatMap((g) => g.items);

/** Short labels for the top bar, where space is tight. */
const SHORT: Record<string, string> = { "/dashboard": "Brief", "/dashboard/briefs": "Past briefs" };

/**
 * Top navigation (md and up; phones use the bottom bar).
 * md: icons only. lg: labels. xl: icons and labels. System and Settings sit in an Admin menu.
 */
export function MainNav({ latestWeek }: { latestWeek: string | null }) {
  const pathname = usePathname();
  const adminActive = ADMIN.some((i) => isActive(pathname, i, latestWeek));
  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex h-9 items-center gap-2 rounded-chip px-2.5 text-sm font-medium transition-colors xl:px-3",
      active ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
    );
  const underline = <span aria-hidden className="absolute inset-x-2.5 -bottom-[11px] h-0.5 rounded-full bg-accent" />;

  return (
    <nav aria-label="Main" className="hidden min-w-0 items-center gap-0.5 md:flex">
      {PRIMARY.map((item) => {
        const active = isActive(pathname, item, latestWeek);
        const Icon = item.icon;
        const label = SHORT[item.href] ?? item.label;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={label} className={linkClass(active)}>
            <Icon size={17} aria-hidden className={cn("shrink-0 lg:hidden xl:block", active && "text-accent")} />
            <span className="sr-only lg:not-sr-only">{label}</span>
            {active ? underline : null}
          </Link>
        );
      })}
      <M.Root>
        <M.Trigger className={cn(linkClass(adminActive), "outline-none focus-visible:ring-2 focus-visible:ring-accent")}>
          <Shield size={17} aria-hidden className={cn("shrink-0 lg:hidden xl:block", adminActive && "text-accent")} />
          <span className="sr-only lg:not-sr-only">Admin</span>
          <ChevronDown size={14} aria-hidden className="hidden lg:block" />
          {adminActive ? underline : null}
        </M.Trigger>
        <M.Portal>
          <M.Content align="end" sideOffset={10} className="anim-pop z-50 min-w-[180px] rounded-panel border border-border bg-surface p-1 shadow-lg">
            {ADMIN.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item, latestWeek);
              return (
                <M.Item key={item.href} asChild>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-chip px-3 text-sm font-medium outline-none data-[highlighted]:bg-surface-2",
                      active ? "text-accent" : "text-fg",
                    )}
                  >
                    <Icon size={17} aria-hidden className="text-muted" />
                    {item.label}
                  </Link>
                </M.Item>
              );
            })}
          </M.Content>
        </M.Portal>
      </M.Root>
    </nav>
  );
}
