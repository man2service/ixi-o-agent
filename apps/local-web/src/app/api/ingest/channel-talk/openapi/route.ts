import { NextRequest, NextResponse } from "next/server";
import { normalizeChannelTalkOpenApiPayload } from "@phone-claw/core";
import { ingestChannelTalkPayload } from "@phone-claw/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PHONE_CLAW_INGEST_SECRET;
  const actualSecret = request.headers.get("x-phone-claw-ingest-secret");

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "server_missing_ingest_secret" },
      { status: 500 }
    );
  }

  if (actualSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "invalid_ingest_secret" },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  try {
    const payload = normalizeChannelTalkOpenApiPayload(rawBody);
    const result = await ingestChannelTalkPayload(payload);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "invalid_or_failed_openapi_ingest", message },
      { status: 400 }
    );
  }
}
