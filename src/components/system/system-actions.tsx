"use client";

import { Mail, Play, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { retryFailedAction, runWorkerAction, sendBriefAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function RunWorkerButton({ running }: { running: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      disabled={pending || running}
      onClick={() =>
        start(async () => {
          const r = await runWorkerAction();
          toast.push(r.message, r.ok ? "success" : "danger");
        })
      }
    >
      <Play size={16} aria-hidden /> {running ? "Worker is running" : pending ? "Starting..." : "Run worker now"}
    </Button>
  );
}

export function SendBriefButtons({ weekLabel, sent, recipients }: { weekLabel: string | null; sent: boolean; recipients: string[] }) {
  if (!weekLabel) {
    return <Button variant="secondary" disabled><Mail size={16} aria-hidden /> Send brief now</Button>;
  }
  const to = recipients.join(", ");
  if (!sent) {
    return (
      <ConfirmDialog
        trigger={<Button variant="secondary"><Mail size={16} aria-hidden /> Send brief now</Button>}
        title={`Send the brief for ${weekLabel}?`}
        impact={[
          { label: "Recipients", text: to },
          { label: "Once only", text: "It is sent once. If sending fails, it stays unsent so you can retry." },
        ]}
        confirmLabel="Send brief"
        onConfirm={() => sendBriefAction(false)}
      />
    );
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="secondary"><Mail size={16} aria-hidden /> Resend brief</Button>}
      title={`Send the ${weekLabel} brief again?`}
      lead="This brief has already been emailed."
      impact={[
        { label: "Recipients", text: to },
        { label: "Duplicate", text: "Everyone on the list will receive a second copy of the same brief." },
      ]}
      confirmLabel="Resend brief"
      onConfirm={() => sendBriefAction(true)}
    />
  );
}

export function RetryFailedButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending || count === 0}
      onClick={() =>
        start(async () => {
          const r = await retryFailedAction();
          toast.push(r.message, r.ok ? "success" : "danger");
        })
      }
    >
      <RefreshCw size={14} aria-hidden /> Retry failed
    </Button>
  );
}
