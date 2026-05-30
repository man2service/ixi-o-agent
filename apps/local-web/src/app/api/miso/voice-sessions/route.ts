import { NextResponse } from "next/server";
import { listMisoVoiceSessions } from "@phone-claw/storage";
import { rejectUnauthorized } from "./auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorized(request);
  if (unauthorized) return unauthorized;

  const sessions = await listMisoVoiceSessions();
  return NextResponse.json({ ok: true, sessions });
}
