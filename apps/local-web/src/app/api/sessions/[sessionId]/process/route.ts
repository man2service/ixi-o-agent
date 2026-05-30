import { NextResponse } from "next/server";
import {
  readStoredVoiceSessionDetail,
  writeExaoneProcessingResult
} from "@phone-claw/storage";
import { processSessionWithLocalExaone } from "../../../../../lib/exaone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
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

  const result = await processSessionWithLocalExaone(session);
  const updatedSession = await writeExaoneProcessingResult(sessionId, result);

  if (wantsJson(request)) {
    return NextResponse.json({ ok: true, session: updatedSession, result });
  }

  return NextResponse.redirect(new URL(`/sessions/${sessionId}`, request.url), 303);
}

function wantsJson(request: Request): boolean {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}
