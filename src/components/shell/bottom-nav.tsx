"use client";

import * as D from "@radix-ui/react-dialog";
import { FileText, MoreHorizontal, Radio, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, onLatestBrief } from "./nav-config";

const EXPLORE_PATHS = ["/dashboard/guests", "/dashboard/topics", "/dashboard/sponsors"];

/** Mobile only. Four tabs; Explore goes to Guests (a segmented switch lives on those pages), More opens a sheet. */
export function BottomNav({ latestWeek }: { latestWeek: string | null }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);

  const tabs = [
    { href: "/dashboard", label: "Brief", icon: FileText, active: onLatestBrief(pathname, latestWeek) || pathname.startsWith("/dashboard/briefs") },
    { href: "/dashboard/guests", label: "Explore", icon: Search, active: EXPLORE_PATHS.some((p) => pathname.startsWith(p)) },
    { href: "/dashboard/shows", label: "Shows", icon: Radio, active: pathname.startsWith("/dashboard/shows") },
  ];
  const moreItems = NAV_GROUPS.flatMap((g) => g.items).filter((i) =>
    ["/dashboard/episodes", "/dashboard/system", "/dashboard/settings", "/dashboard/briefs"].includes(i.href),
  );
  const moreActive = moreItems.some((i) => i.href !== "/dashboard/briefs" && pathname.startsWith(i.href));

  const itemClass = (active: boolean) =>
    cn("flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-accent" : "text-muted");

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={itemClass(t.active)}>
          <t.icon size={20} aria-hidden />
          {t.label}
        </Link>
      ))}
      <D.Root open={more} onOpenChange={setMore}>
        <D.Trigger className={itemClass(moreActive)}>
          <MoreHorizontal size={20} aria-hidden />
          More
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/50 anim-fade" />
          <D.Content className="anim-fade fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] outline-none">
            <div className="mb-2 flex items-center justify-between">
              <D.Title className="text-base font-semibold">More</D.Title>
              <D.Close aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-chip text-muted hover:bg-surface-2">
                <X size={18} aria-hidden />
              </D.Close>
            </div>
            <D.Description className="sr-only">Other sections of the dashboard</D.Description>
            <ul>
              {moreItems.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setMore(false)} className="flex min-h-[48px] items-center gap-3 rounded-chip px-2 text-sm font-medium hover:bg-surface-2">
                    <i.icon size={18} aria-hidden className="text-muted" />
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </D.Content>
        </D.Portal>
      </D.Root>
    </nav>
  );
}
