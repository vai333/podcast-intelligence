import { Gauge } from "lucide-react";
import Link from "next/link";
import type { Coverage } from "@/lib/data/types";

/** One short line of trust: how much of the week we actually analysed. */
export function CoverageLine({ coverage }: { coverage: Coverage }) {
  const analyzed = coverage.analyzedVideo + coverage.analyzedMetadata;
  return (
    <p className="flex items-start gap-2 text-sm text-muted">
      <Gauge size={16} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">
        Analyzed <span className="num font-medium text-fg">{analyzed}</span> of <span className="num font-medium text-fg">{coverage.episodesFound}</span> episodes
        {coverage.analyzedMetadata ? ` (${coverage.analyzedMetadata} metadata-only)` : ""}.
        {coverage.skippedOrFailed ? ` ${coverage.skippedOrFailed} skipped or failed.` : ""}
        {coverage.skippedOrFailed || coverage.analyzedMetadata ? (
          <>
            {" "}
            <Link href="/dashboard/episodes?status=failed" className="font-medium text-accent underline-offset-2 hover:underline">
              Details
            </Link>
          </>
        ) : null}
      </span>
    </p>
  );
}
