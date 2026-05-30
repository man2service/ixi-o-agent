import { NextResponse } from "next/server";

export function rejectUnauthorized(request: Request): NextResponse | undefined {
  const expected = process.env.PHONE_CLAW_INGEST_SECRET;
  if (!expected) return undefined;

  const headerSecret = request.headers.get("x-phone-claw-ingest-secret");
  const bearerSecret = parseBearerToken(request.headers.get("authorization"));

  if (headerSecret === expected || bearerSecret === expected) {
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

function parseBearerToken(value: string | null): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return undefined;
  return token;
}
