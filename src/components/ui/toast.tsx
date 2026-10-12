"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "danger" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}
const Ctx = createContext<{ push: (message: string, tone?: Tone) => void }>({ push: () => {} });

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 6000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "anim-fade pointer-events-auto flex max-w-md items-start gap-3 rounded-panel border px-4 py-3 text-sm shadow-lg",
              t.tone === "success" && "border-success/30 bg-success-soft text-success",
              t.tone === "danger" && "border-danger/30 bg-danger-soft text-danger",
              t.tone === "info" && "border-border bg-surface text-fg",
            )}
          >
            {t.tone === "success" ? <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" /> : <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />}
            <span>{t.message}</span>
            <button
              aria-label="Dismiss"
              className="-mr-1 ml-1 rounded p-0.5 opacity-70 hover:opacity-100"
              onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
