import { Clock, LogOut, Radio as Logo } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import type { Meta } from "@/lib/data/repo";
import type { MockScenario } from "@/lib/data/types";
import { formatIST, relativeTime } from "@/lib/time";
import { ScenarioSwitcher } from "./scenario-switcher";
import { ThemeToggle } from "./theme-toggle";

export function TopBar({ meta, scenario }: { meta: Meta; scenario: MockScenario }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur md:px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold md:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-accent text-accent-fg">
          <Logo size={16} aria-hidden />
        </span>
        <span className="hidden text-[15px] min-[420px]:inline">Podcast Intel</span><span className="sr-only min-[420px]:hidden">Podcast Intelligence</span>
      </Link>
      <div className="hidden items-center gap-3 md:flex">
        <Chip tone="outline" icon={<Clock size={12} />}>
          All times IST
        </Chip>
        <span className="text-xs text-muted">
          Data as of <span className="num">{formatIST(meta.lastDataAt, "daytime")}</span> ({relativeTime(meta.lastDataAt, meta.now)})
        </span>
      </div>
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
    </header>
  );
}
