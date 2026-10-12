import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCredentials, recordFailure, safeNext, tooManyFailures } from "@/lib/auth/credentials";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string().max(100), password: z.string().max(200), next: z.string().max(200).optional() });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (await tooManyFailures(ip)) return NextResponse.json({ ok: false, message: "Too many failed attempts. Try again in a few minutes." }, { status: 429 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success || !checkCredentials(body.data.username, body.data.password)) {
    await recordFailure(ip);
    return NextResponse.json({ ok: false, message: "Incorrect username or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, next: safeNext(body.data.next) });
  res.cookies.set(SESSION_COOKIE, await signSession(), cookieOptions());
  return res;
}
