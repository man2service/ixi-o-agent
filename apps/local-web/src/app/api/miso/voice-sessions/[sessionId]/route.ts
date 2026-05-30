import { NextResponse } from "next/server";
import { readMisoVoiceSession } from "@phone-claw/storage";
import { rejectUnauthorized } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const unauthorized = rejectUnauthorized(request);
  if (unauthorized) return unauthorized;

  const { sessionId } = await context.params;
  const session = await readMisoVoiceSession(sessionId);
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "session_not_found"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, session });
}
