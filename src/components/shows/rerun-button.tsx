"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { rerunExtractionAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function RerunButton({ episodeId, title }: { episodeId: string; title: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Re-run extraction for ${title}`}
      onClick={() =>
        start(async () => {
          const r = await rerunExtractionAction(episodeId);
          toast.push(r.message, r.ok ? "success" : "danger");
        })
      }
    >
      <RefreshCw size={14} aria-hidden className={pending ? "animate-spin" : undefined} />
      {pending ? "Queuing..." : "Re-run"}
    </Button>
  );
}
