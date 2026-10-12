// Signed, httpOnly session cookie (jose, HS256). Works in the Edge runtime (middleware) and Node.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pi_session";
export const SESSION_DAYS = 30; // sliding: reissued when older than a day
export const SESSION_MAX_AGE = SESSION_DAYS * 86_400;

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function signSession(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export interface SessionInfo {
  valid: boolean;
  /** Seconds since the token was issued. */
  ageSec: number;
}

export async function readSession(token: string | undefined): Promise<SessionInfo> {
  if (!token || (process.env.SESSION_SECRET ?? "").length < 32) return { valid: false, ageSec: 0 };
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { valid: payload.sub === "admin", ageSec: Math.floor(Date.now() / 1000) - (payload.iat ?? 0) };
  } catch {
    return { valid: false, ageSec: 0 };
  }
}

export const cookieOptions = (maxAge = SESSION_MAX_AGE) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
