import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth/guard";
import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) return unauthorized();
  return NextResponse.json(await repo.mutations.runWorkerNow());
}
