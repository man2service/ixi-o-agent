import { NextResponse } from "next/server";
import { getIngestSecret, getIngestSecretFromRequest } from "../../../../lib/runtime-config";

export function rejectUnauthorized(request: Request): NextResponse | undefined {
  const expected = getIngestSecret();
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error: "ingest_secret_not_configured",
        message: "IXI_O_AGENT_INGEST_SECRET is required before exposing MISO tool endpoints."
      },
      { status: 503 }
    );
  }

  if (getIngestSecretFromRequest(request) === expected) {
    return undefined;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "unauthorized"
    },
    { status: 401 }
  );
}
