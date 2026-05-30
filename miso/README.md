# Phone-Claw MISO Tooling

Phone-Claw does not push raw call audio or raw transcripts into MISO.

The MISO builder guide says MISO can call external REST APIs as custom tools
and can register MCP tools. It does not document a first-class inbound voice
event ingest API. For the hackathon MVP, Phone-Claw exposes a restricted local
REST tool that MISO can call after the user has reviewed a session.

## Files

- `phone-claw-openapi.json`: OpenAPI 3.1 schema for registering Phone-Claw as a MISO custom tool.
- `mcp-tool-proposal.json`: MCP tool shape we would propose if MISO wants a local MCP bridge.

## Security Rule

The custom tool endpoints require a bearer token or `x-phone-claw-ingest-secret`
matching the local `PHONE_CLAW_INGEST_SECRET`.

The detail endpoint does not return a handoff payload until the local review
state has both:

```json
{
  "reviewed": true,
  "externalAllowed": true
}
```

Until then, MISO receives only metadata and a blocked reason. Raw transcript and
raw audio are never included in the MISO-facing response.

## MISO Registration

In MISO:

1. Open `플레이그라운드` -> `도구 모음` -> `사용자 정의`.
2. Create a custom tool.
3. Paste `phone-claw-openapi.json`.
4. Set auth as Bearer Token with the local Phone-Claw ingest secret.
5. Import sub-tools and test `listVoiceSessions`.

If the endpoint is exposed through Cloudflare Tunnel, replace
`servers[0].url` with the tunnel URL before pasting into MISO.
