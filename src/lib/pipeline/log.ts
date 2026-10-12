// Every skip or failure writes a row here (spec 14). Logging must never throw.
import { db } from "@/lib/db/client";
import { ingestionLog } from "@/lib/db/schema";
import { redact } from "@/lib/http";

export type LogLevel = "info" | "warn" | "error";
export type LogScope = "show" | "episode" | "api" | "queue" | "email";

export async function logEvent(level: LogLevel, scope: LogScope, message: string, ref?: { id?: string; label?: string }): Promise<void> {
  try {
    await db()
      .insert(ingestionLog)
      .values({ level, scope, message: redact(message).slice(0, 1000), refId: ref?.id ?? null, refLabel: ref?.label?.slice(0, 200) ?? null });
  } catch (e) {
    console.error("[log] failed to write ingestion_log", e instanceof Error ? e.message : e);
  }
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
