import { Clock } from "lucide-react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { repo } from "@/lib/data";
import { currentScenario } from "@/lib/data/mock/repo";
import { formatIST, relativeTime } from "@/lib/time";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [meta, scenario, latest] = await Promise.all([repo.meta(), currentScenario(), repo.getLatestBrief()]);
  const latestWeek = latest?.weekStart ?? null;
  return (
    <ToastProvider>
      <TopBar meta={meta} scenario={scenario} latestWeek={latestWeek} />
      {meta.isSample ? (
        <aside aria-label="Sample data notice" className="border-b border-border bg-warn-soft px-4 py-1.5 text-center text-xs text-warn md:px-6">
          <span className="sm:hidden">Sample data: everything here is invented.</span>
          <span className="hidden sm:inline">Sample data: shows are real, but every episode, guest, company and sponsor here is invented.</span>
        </aside>
      ) : null}
      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 md:px-6 md:pt-8">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 pb-28 pt-4 text-xs text-muted md:px-6 md:pb-8">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={12} aria-hidden /> All times IST
        </span>
        <span aria-hidden>·</span>
        <span>
          Data as of <span className="num">{formatIST(meta.lastDataAt, "daytime")}</span> ({relativeTime(meta.lastDataAt, meta.now)})
        </span>
      </footer>
      <BottomNav latestWeek={latestWeek} />
    </ToastProvider>
  );
}
