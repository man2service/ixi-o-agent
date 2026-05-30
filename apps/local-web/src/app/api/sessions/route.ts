import { NextResponse } from "next/server";
import { listStoredVoiceSessions } from "@phone-claw/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await listStoredVoiceSessions();
  return NextResponse.json({ ok: true, sessions });
}
