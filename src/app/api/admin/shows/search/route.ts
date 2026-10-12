import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth/guard";
import { searchShowCandidates } from "@/lib/services/show-search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length > 200) return NextResponse.json({ error: "Query too long" }, { status: 400 });
  return NextResponse.json({ candidates: await searchShowCandidates(q) });
}
