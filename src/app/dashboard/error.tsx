"use client";

import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/states";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[760px]">
      <ErrorPanel
        title="Couldn't load this page"
        action={<Button variant="secondary" onClick={reset}>Try again</Button>}
      >
        Your data is safe. This is usually temporary, so try again in a moment.
      </ErrorPanel>
    </div>
  );
}
