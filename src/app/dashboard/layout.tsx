import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { repo } from "@/lib/data";
import { currentScenario } from "@/lib/data/mock/repo";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [meta, scenario, latest] = await Promise.all([repo.meta(), currentScenario(), repo.getLatestBrief()]);
  const latestWeek = latest?.weekStart ?? null;
  return (
    <ToastProvider>
      <Sidebar latestWeek={latestWeek} />
      <div className="md:pl-16 lg:pl-[232px]">
        <TopBar meta={meta} scenario={scenario} />
        {meta.isSample ? (
          <aside aria-label="Sample data notice" className="border-b border-border bg-warn-soft px-4 py-1.5 text-center text-xs text-warn md:px-6">
            <span className="sm:hidden">Sample data: everything here is invented.</span>
            <span className="hidden sm:inline">Sample data: shows are real, but every episode, guest, company and sponsor here is invented.</span>
          </aside>
        ) : null}
        <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 md:px-6 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
      <BottomNav latestWeek={latestWeek} />
    </ToastProvider>
  );
}
