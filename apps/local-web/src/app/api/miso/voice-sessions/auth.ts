import { NextResponse } from "next/server";
import { getIngestSecret, getIngestSecretFromRequest } from "../../../../lib/runtime-config";

export function rejectUnauthorized(request: Request): NextResponse | undefined {
  const expected = getIngestSecret();
  if (!expected) return undefined;

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
