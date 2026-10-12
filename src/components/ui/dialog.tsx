"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useToast } from "./toast";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = "fixed inset-0 z-40 bg-black/50 anim-fade";

/** Centered modal on desktop, full-screen sheet on mobile when `side` is "right". */
export function DialogContent({
  title,
  description,
  children,
  side,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "right";
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border border-border bg-surface shadow-2xl outline-none",
          side === "right"
            ? "anim-sheet inset-0 sm:left-auto sm:w-[520px] sm:border-y-0 sm:border-r-0"
            : "anim-pop left-1/2 top-1/2 max-h-[90vh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-panel",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <D.Title className="text-lg font-semibold leading-6">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : null}
          </div>
          <D.Close
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-chip text-muted hover:bg-surface-2"
          >
            <X size={18} aria-hidden />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/**
 * A confirmation that states its consequences in plain words.
 * `impact` is rendered as a list so each consequence is scannable.
 */
export function ConfirmDialog({
  trigger,
  title,
  lead,
  impact,
  confirmLabel,
  tone = "primary",
  onConfirm,
  disabled,
}: {
  trigger: React.ReactNode;
  title: string;
  lead?: string;
  impact: { label: string; text: string }[];
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild disabled={disabled}>
        {trigger}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className="anim-pop fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-panel border border-border bg-surface p-5 shadow-2xl outline-none">
          <AlertDialog.Title className="text-lg font-semibold leading-6">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted">{lead ?? "Please check the details below."}</AlertDialog.Description>
          <ul className="mt-4 space-y-3">
            {impact.map((i) => (
              <li key={i.label} className="text-sm">
                <span className="font-semibold">{i.label}.</span> <span className="text-muted">{i.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await onConfirm();
                  toast.push(res.message, res.ok ? "success" : "danger");
                  if (res.ok) setOpen(false);
                })
              }
            >
              {pending ? "Working..." : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
