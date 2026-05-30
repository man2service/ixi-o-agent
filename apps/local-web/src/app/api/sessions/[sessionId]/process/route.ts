import { NextResponse } from "next/server";
import {
  readStoredVoiceSessionDetail,
  writeExaoneProcessingResult
} from "@phone-claw/storage";
import { processSessionWithLocalExaone } from "../../../../../lib/exaone";
import { notifyKiyaForSession } from "../../../../../lib/kiya";

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
  const kiya =
    process.env.PHONE_CLAW_KIYA_AUTO_NOTIFY === "false"
      ? {
          skipped: true,
          reason: "PHONE_CLAW_KIYA_AUTO_NOTIFY=false"
        }
      : await notifyKiyaForSession(updatedSession);

  if (wantsJson(request)) {
    return NextResponse.json({ ok: true, session: updatedSession, result, kiya });
  }

  const kiyaStatus =
    "skipped" in kiya ? "skipped" : kiya.telegram.status === "sent" ? "sent" : "dry_run";
  return NextResponse.redirect(
    new URL(`/sessions/${sessionId}?kiya=${kiyaStatus}`, request.url),
    303
  );
}

function wantsJson(request: Request): boolean {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}
