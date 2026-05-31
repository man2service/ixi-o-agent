import { NextRequest, NextResponse } from "next/server";
import { channelTalkN8nPayloadSchema } from "@ixi-o-agent/core";
import { ingestChannelTalkPayload } from "@ixi-o-agent/storage";
import { getIngestSecret, getIngestSecretFromRequest } from "../../../../lib/runtime-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expectedSecret = getIngestSecret();
  const actualSecret = getIngestSecretFromRequest(request);

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

  const parsed = channelTalkN8nPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  try {
    const result = await ingestChannelTalkPayload(parsed.data);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "ingest_failed", message },
      { status: 500 }
    );
  }
}
