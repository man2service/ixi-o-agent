# ixi-O Agent MISO Tooling

ixi-O Agent does not push raw call audio or raw transcripts into MISO.

The MISO builder guide says MISO can call external REST APIs as custom tools
and can register MCP tools. It does not document a first-class inbound voice
event ingest API. For the hackathon MVP, ixi-O Agent exposes a restricted local
REST tool that MISO can call after the user has reviewed a session. The inbound
voice event is presented as a concrete proposal, not as a claimed existing MISO
push integration.

## Files

- `ixi-o-agent-openapi.v3.json`: OpenAPI 3.0 template for registering ixi-O Agent as a MISO custom tool.
- `ixi-o-agent-openapi.json`: OpenAPI 3.1 template, only if the MISO importer accepts OpenAPI 3.1.
- `apps/ixi-o-agent-voiceops-copilot.yml`: importable MISO agent draft for the judging demo.
- `samples/approved-voice-session-handoff.sample.json`: safe fallback payload for judging when live tool auth/tunnel is unstable.
- `samples/blocked-voice-session-detail.sample.json`: safe fallback payload that proves the human-review gate.
- `mcp-tool-proposal.json`: MCP tool shape we would propose if MISO wants a local MCP bridge.
- `proposed-inbound-voice-event.schema.json`: JSON schema for the inbound voice event we propose MISO should support later.
- `proposed-miso-interfaces.md`: readable explanation of implemented pull APIs vs proposed MISO interfaces.
- `voice-session-workflow-outline.md`: visual workflow/chaining outline for turning a session into a MISO business card and next actions.

## What Works Now

MISO can be configured to call ixi-O Agent's restricted local REST API:

- `GET /api/miso/voice-sessions`
- `GET /api/miso/voice-sessions/{sessionId}`

These endpoints support Channel Talk/n8n sessions and Private Mode local voice
sessions. In the returned handoff payload, `sourceSystem` is either
`channel_talk` or `local_voice`.

## What Is Proposed

MISO would need an inbound voice event or MCP resource ingest capability to let
external voice systems start workflows directly. ixi-O Agent defines that
proposal in `proposed-inbound-voice-event.schema.json` and
`proposed-miso-interfaces.md`.

## Security Rule

When MISO calls the restricted gateway, it must use a bearer token matching
`IXI_O_AGENT_MISO_GATEWAY_TOKEN`. The gateway then calls the local Next app with
the local `IXI_O_AGENT_INGEST_SECRET`. The full local Next app should not be
tunneled for judging.

The gateway fails closed when `IXI_O_AGENT_MISO_GATEWAY_TOKEN` is not set or
still contains a placeholder value. Do not use the long-lived local ingest
secret as the MISO tool credential.

When testing the local Next API directly, use `IXI_O_AGENT_INGEST_SECRET` as
the bearer token or `x-ixi-o-agent-ingest-secret` header.

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
3. Paste a tunnel-specific generated OpenAPI schema. For a live cloud MISO
   demo, do not paste the static templates as-is because their server URL is
   local-only.
4. Set auth as Bearer Token with `IXI_O_AGENT_MISO_GATEWAY_TOKEN`.
5. Import sub-tools and test `listVoiceSessions`.
6. Import `apps/ixi-o-agent-voiceops-copilot.yml` from `앱 만들기` -> `기존 앱 가져오기`.
7. Add the custom tool to the imported app, then save and share.

Expose only the MISO gateway, not the full local Next app.

Terminal 1, local Next app:

```bash
set -a
source .env.local
set +a
pnpm dev
```

Terminal 2, MISO gateway:

```bash
set -a
source .env.local
set +a
export IXI_O_AGENT_MISO_GATEWAY_TOKEN=<short-lived-demo-token>
pnpm miso:gateway
```

Terminal 3, Cloudflare tunnel:

```bash
cloudflared tunnel --url http://localhost:3321
```

Terminal 4, generate the live OpenAPI schema:

```bash
pnpm miso:openapi:v3 https://<trycloudflare-host>
```

Then paste `miso/generated/ixi-o-agent-openapi.current-tunnel.v3.json` into
MISO.

Cloudflare quick tunnel URLs are ephemeral. If the tunnel or token changes,
update the existing MISO custom tool schema and bearer token, then re-test
`listVoiceSessions` and `readVoiceSessionHandoff`.

For a full judging checklist, see `docs/miso-track-submission-runbook.md`.

## Local Verification

Validate the MISO artifacts:

```bash
node -e "for (const f of ['miso/ixi-o-agent-openapi.json','miso/mcp-tool-proposal.json','miso/proposed-inbound-voice-event.schema.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok')"
```

Validate the MISO app import draft:

```bash
ruby -e "require 'yaml'; YAML.load_file('miso/apps/ixi-o-agent-voiceops-copilot.yml'); puts 'ok'"
```

Inspect the implemented API:

```bash
curl -fsS \
  -H "Authorization: Bearer $IXI_O_AGENT_INGEST_SECRET" \
  http://localhost:3000/api/miso/voice-sessions
```
