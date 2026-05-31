import { NextResponse } from "next/server";
import { readStoredVoiceSessionDetail } from "@ixi-o-agent/storage";
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

  const result = await notifyKiyaForSession(session);

  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, result });
  }

  const status = result.telegram.status === "sent" ? "sent" : "dry_run";
  return NextResponse.redirect(
    new URL(`/sessions/${sessionId}?kiya=${status}`, request.url),
    303
  );
}
