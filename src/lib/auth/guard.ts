// Server-side admin check for server actions and API routes (defence in depth behind the middleware).
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "./session";

/** In mock mode during development there is no login, so local UI work stays easy. */
const devBypass = () => process.env.DATA_SOURCE === "mock" && process.env.NODE_ENV !== "production";

export async function isAdmin(): Promise<boolean> {
  if (devBypass()) return true;
  return (await readSession((await cookies()).get(SESSION_COOKIE)?.value)).valid;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not signed in.");
}

export const unauthorized = () => NextResponse.json({ error: "Not signed in." }, { status: 401 });
