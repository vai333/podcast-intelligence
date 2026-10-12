// Protects every /dashboard page and /api/admin route. Cookie verification only (Edge-safe, no database).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, readSession, signSession } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  if (process.env.DATA_SOURCE === "mock" && process.env.NODE_ENV !== "production") return NextResponse.next();

  const s = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s.valid) {
    if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Sliding session: keep it alive for another SESSION_DAYS whenever it is more than a day old.
  if (s.ageSec > 86_400) res.cookies.set(SESSION_COOKIE, await signSession(), cookieOptions());
  return res;
}

export const config = { matcher: ["/dashboard/:path*", "/api/admin/:path*"] };
