"use client";

import * as P from "@radix-ui/react-popover";
import * as T from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/** Hover/focus hint. Keep the content short; anything important must also be visible in the page. */
export function Tip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            sideOffset={6}
            className="z-50 max-w-[260px] rounded-chip border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg shadow-lg"
          >
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

/** Click-to-open popover (works on touch, unlike a tooltip). */
export function Pop({
  trigger,
  children,
  className,
  label,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          aria-label={label}
          sideOffset={6}
          collisionPadding={12}
          className={cn("z-50 w-[300px] max-w-[calc(100vw-24px)] rounded-panel border border-border bg-surface p-4 text-sm shadow-xl", className)}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
