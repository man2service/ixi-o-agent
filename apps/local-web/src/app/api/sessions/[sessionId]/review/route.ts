import { NextResponse } from "next/server";
import { updateVoiceSessionReview } from "@phone-claw/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const formData = await request.formData().catch(() => undefined);
  const externalAllowed = formData?.get("externalAllowed") === "true";
  const reviewed = formData?.get("reviewed") !== "false";
  const note = formData?.get("note");

  const updatedSession = await updateVoiceSessionReview(sessionId, {
    reviewed,
    externalAllowed,
    note: typeof note === "string" && note.trim() ? note.trim() : undefined
  });

  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, session: updatedSession });
  }

  return NextResponse.redirect(new URL(`/sessions/${sessionId}`, request.url), 303);
}
