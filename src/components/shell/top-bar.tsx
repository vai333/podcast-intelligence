import { LogOut, Radio as Logo } from "lucide-react";
import Link from "next/link";
import type { Meta } from "@/lib/data/repo";
import type { MockScenario } from "@/lib/data/types";
import { MainNav } from "./main-nav";
import { ScenarioSwitcher } from "./scenario-switcher";
import { ThemeToggle } from "./theme-toggle";

/** The one header: logo, main navigation and account controls. Phones get the bottom bar for navigation. */
export function TopBar({ meta, scenario, latestWeek }: { meta: Meta; scenario: MockScenario; latestWeek: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 md:gap-5 md:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-accent text-accent-fg">
            <Logo size={16} aria-hidden />
          </span>
          <span className="hidden text-[15px] min-[420px]:inline md:hidden xl:inline">Podcast Intelligence</span>
          <span className="hidden text-[15px] md:inline xl:hidden">Podcast Intel</span>
          <span className="sr-only min-[420px]:hidden">Podcast Intelligence</span>
        </Link>
        <MainNav latestWeek={latestWeek} />
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {meta.isSample ? <ScenarioSwitcher current={scenario} /> : null}
          <ThemeToggle />
          {!meta.isSample ? (
            <form action="/api/auth/logout" method="post">
              <button type="submit" aria-label="Sign out" title="Sign out" className="inline-flex h-10 w-10 items-center justify-center rounded-chip text-muted hover:bg-surface-2 hover:text-fg">
                <LogOut size={18} aria-hidden />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
