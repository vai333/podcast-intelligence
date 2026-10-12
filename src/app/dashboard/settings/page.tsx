import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { repo } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await repo.getSettings();
  return (
    <div>
      <PageHeader title="Settings" subtitle="Limits and thresholds. Changes apply from the next nightly run and never alter past briefs." />
      <SettingsForm initial={settings} />
    </div>
  );
}
