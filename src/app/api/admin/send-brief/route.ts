import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth/guard";
import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = z.object({ resend: z.boolean().default(false) }).safeParse(await req.json().catch(() => ({})));
  return NextResponse.json(await repo.mutations.sendBriefNow({ resend: body.success ? body.data.resend : false }));
}
