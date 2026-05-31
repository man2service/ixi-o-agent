import { NextResponse } from "next/server";
import { readStoredVoiceSessionDetail } from "@ixi-o-agent/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const session = await readStoredVoiceSessionDetail(sessionId);
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
