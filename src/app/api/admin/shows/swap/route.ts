import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth/guard";
import { swapShow } from "@/lib/services/shows";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = z.object({ outShowId: z.string().uuid(), candidate: z.unknown() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  return NextResponse.json(await swapShow(body.data.outShowId, body.data.candidate));
}
