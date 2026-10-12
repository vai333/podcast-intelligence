// Cron and worker routes accept only `Authorization: Bearer ${CRON_SECRET}` (spec 4.1).
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "./credentials";

export function cronAuthorized(req: Request): boolean {
  const h = req.headers.get("authorization") ?? "";
  return safeEqual(h, `Bearer ${env().CRON_SECRET}`);
}

export const rejected = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
