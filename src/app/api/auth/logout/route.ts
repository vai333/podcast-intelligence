import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", env().APP_URL), 303);
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0) });
  return res;
}
