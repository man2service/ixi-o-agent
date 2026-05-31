const CURRENT_PREFIX = "IXI_O_AGENT_";
const LEGACY_PREFIX = "PHONE_CLAW_";

export function getIxiOAgentEnv(name: string): string | undefined {
  return process.env[`${CURRENT_PREFIX}${name}`] ?? process.env[`${LEGACY_PREFIX}${name}`];
}

export function getIngestSecret(): string | undefined {
  return getIxiOAgentEnv("INGEST_SECRET");
}

export function getIngestSecretFromRequest(request: Request): string | undefined {
  return (
    request.headers.get("x-ixi-o-agent-ingest-secret") ??
    request.headers.get("x-phone-claw-ingest-secret") ??
    parseBearerToken(request.headers.get("authorization"))
  );
}

export function isAuthorizedByIngestSecret(request: Request): boolean {
  const expected = getIngestSecret();
  if (!expected) return true;
  return getIngestSecretFromRequest(request) === expected;
}

export function parseBearerToken(value: string | null): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return undefined;
  return token;
}
