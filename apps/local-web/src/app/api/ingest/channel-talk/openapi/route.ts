import { NextRequest, NextResponse } from "next/server";
import { normalizeChannelTalkOpenApiPayload } from "@ixi-o-agent/core";
import { ingestChannelTalkPayload } from "@ixi-o-agent/storage";
import { getIngestSecret, getIngestSecretFromRequest } from "../../../../../lib/runtime-config";

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

  if (isOperationalHealthcheck(rawBody)) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "operational_healthcheck" },
      { status: 202 }
    );
  }

  try {
    const payload = normalizeChannelTalkOpenApiPayload(rawBody);
    const result = await ingestChannelTalkPayload(payload);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.warn(
      "channel_talk_openapi_ingest_rejected",
      JSON.stringify({ message, rawShape: describeRawShape(rawBody) })
    );
    return NextResponse.json(
      { ok: false, error: "invalid_or_failed_openapi_ingest", message },
      { status: 400 }
    );
  }
}

function isOperationalHealthcheck(value: unknown): boolean {
  const body = getRecord(value);
  if (!body) return false;
  return (
    body.event === "healthcheck" &&
    typeof body.source === "string" &&
    (body.source.startsWith("ixi-o-agent") || body.source.startsWith("phone-claw"))
  );
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function describeRawShape(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return {
      type: "string",
      length: value.length,
      startsWithJsonObject: value.trim().startsWith("{")
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: Array.isArray(value) ? "array" : typeof value };
  }

  const record = value as Record<string, unknown>;
  const body = record.body;
  const emptyKeyValue = record[""];
  return {
    type: "object",
    keys: Object.keys(record),
    emptyKeyType: typeof emptyKeyValue,
    emptyKeyKeys:
      emptyKeyValue && typeof emptyKeyValue === "object" && !Array.isArray(emptyKeyValue)
        ? Object.keys(emptyKeyValue as Record<string, unknown>)
        : undefined,
    emptyKeyStartsWithJsonObject:
      typeof emptyKeyValue === "string" ? emptyKeyValue.trim().startsWith("{") : undefined,
    bodyType: typeof body,
    bodyKeys:
      body && typeof body === "object" && !Array.isArray(body)
        ? Object.keys(body as Record<string, unknown>)
        : undefined,
    bodyStartsWithJsonObject:
      typeof body === "string" ? body.trim().startsWith("{") : undefined
  };
}
