# MISO Track Submission Runbook

## Goal

Submit ixi-O Agent to the MISO track as a runnable enterprise workflow demo plus
a concrete next-interface proposal.

Core message:

> ixi-O Agent turns calls and meetings into reviewed, redacted voice-session
> handoffs. MISO can use those handoffs as enterprise workflow input today via a
> custom tool, and should expose an inbound voice-session event or MCP resource
> ingest next.

## Source Basis

Local source files reviewed:

- `contest-source-pack/raw/google-drive/MISO_OBA_HACKATHON_BUILDERS_GUIDE.md`
- `contest-source-pack/raw/google-drive/miso-track-presentation-gs-neotech.pdf`
- `contest-source-pack/raw/google-drive/yml/*.yml`
- `current/miso-handoff-feasibility-and-proposal.md`
- `miso/README.md`
- `miso/proposed-miso-interfaces.md`

Important constraints from the source material:

- MISO apps must be saved and shared before judges/team members in the
  workspace can run the latest version.
- MISO supports custom REST tools through OpenAPI 3.x schemas.
- MISO supports MCP tool registration.
- The MISO track presentation frames the track as hard mode: public open APIs
  are not the main assumption, and API/MCP/webhook/schema proposals are part of
  the expected value.

## Submission Artifacts

Prepare these links/files for judging:

- GitHub: `https://github.com/man2service/ixi-o-agent`
- Public experience page: `https://ixi-o-agent.vercel.app`
- MISO app YAML import draft: `miso/apps/ixi-o-agent-voiceops-copilot.yml`
- MISO custom tool OpenAPI templates:
  - `miso/ixi-o-agent-openapi.v3.json` for OpenAPI 3.0 import
  - `miso/ixi-o-agent-openapi.json` for OpenAPI 3.1 import if accepted
- Live tunnel OpenAPI snapshot for the current rehearsal:
  `docs/evidence/miso/ixi-o-agent-openapi.current-tunnel.v3.json`
- Approved fallback payload: `miso/samples/approved-voice-session-handoff.sample.json`
- Blocked-before-review payload: `miso/samples/blocked-voice-session-detail.sample.json`
- Interface proposal docs:
  - `miso/proposed-miso-interfaces.md`
  - `miso/proposed-inbound-voice-event.schema.json`
  - `miso/mcp-tool-proposal.json`
  - `miso/voice-session-workflow-outline.md`

## MISO Workspace Setup

Important packaging note:

- `miso/apps/ixi-o-agent-voiceops-copilot.yml` preserves the agent prompt,
  suggested questions, model settings, and fallback behavior.
- MISO does not export/import our local custom-tool credential binding in that
  YAML. After importing the app, manually attach the custom tool named
  `ixi-O Agent VoiceOps Bridge`, then save and share it.
- If MISO later exports tool bindings in app YAML, re-export the published app
  and replace the draft.

### Current Hackathon Workspace State

As of 2026-05-31 12:57 KST:

- Workspace: `럭키밀 (모난돌컴퍼니) Team`
- App: `ixi-O Agent VoiceOps Copilot`
- App config URL: `https://console.miso.gs/app-config/chat/a61da945-3cf7-466a-b8fe-c59a48ea07e9`
- App runtime URL: `https://console.miso.gs/chatList/T4JZ5CTOJpifUz3L`
- App status: imported, custom tool attached, saved, shared as `현재 워크스페이스 공개`
- Custom tool: `ixi-O Agent VoiceOps Bridge`
- Enabled sub-tools: `listVoiceSessions`, `readVoiceSessionHandoff`
- Current demo gateway URL: `https://<trycloudflare-host>`
- Current live OpenAPI schema snapshot: `docs/evidence/miso/ixi-o-agent-openapi.current-tunnel.v3.json`
- `listVoiceSessions` MISO tool test: passed, returned `ok: true` with 67 sessions
- Verified session: `20260531T023933_utc_local_voice_1fa0e9c632`
- `readVoiceSessionHandoff` MISO tool test: passed, returned approved,
  redacted handoff with no raw audio or raw transcript
- Runtime prompt test: `승인된 voice session 목록을 보고 업무 카드로 정리해 주세요.`
- Verified response shape: MISO produced a business card, next actions, Human
  Review, and MISO interface proposal from the approved redacted handoff.
- Evidence doc: `docs/miso-submit-evidence.md`

The disposable MISO account password is intentionally not stored in this repo.
Operators need access to the `럭키밀 (모난돌컴퍼니) Team` MISO workspace to use
the live app/config URLs. If a judge or teammate lacks access, use the fallback
JSON paste demo in Scenario B instead.

### 0. Run Local Web And The MISO Gateway

The local Next app lives under `apps/local-web`, so a root `.env.local` is not
automatically loaded by `next dev` unless the variables are exported first.
Before exposing anything to MISO, make sure `IXI_O_AGENT_INGEST_SECRET` is
available to the running server.

If you run `pnpm build` while `next dev` is already serving the local API,
restart `next dev` before a live MISO demo. The production build can rewrite
`.next` while the dev server is running, which may temporarily make API routes
return 500 until the dev server is restarted.

Safe local check:

```bash
curl -i http://localhost:3000/api/miso/voice-sessions
```

Expected without a bearer token:

- `401 unauthorized` when the secret is configured
- `503 ingest_secret_not_configured` when the server was started without the secret

Do not register the live custom tool in MISO while the endpoint returns `503`.

Do not tunnel the full Next app. Start the local API, MISO-only gateway, and
tunnel in separate terminals.

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

Terminal 3, Cloudflare tunnel to the gateway:

```bash
cloudflared tunnel --url http://localhost:3321
```

Terminal 4, generate the live OpenAPI schema after the tunnel URL appears:

```bash
pnpm miso:openapi:v3 https://<trycloudflare-host>
```

Then paste `miso/generated/ixi-o-agent-openapi.current-tunnel.v3.json` into
the existing MISO custom tool and re-test both sub-tools.

`pnpm miso:gateway` fails closed if `IXI_O_AGENT_MISO_GATEWAY_TOKEN` is not set
or still contains a placeholder value. Do not reuse `IXI_O_AGENT_INGEST_SECRET`
as the MISO bearer token.

The gateway allows only:

- `GET /api/miso/voice-sessions`
- `GET /api/miso/voice-sessions/{sessionId}`

All local UI, raw session APIs, review actions, and source transcripts stay off
the public tunnel.

### 1. Register the Custom Tool

1. Open `플레이그라운드` -> `도구 모음` -> `사용자 정의`.
2. Create a custom tool named `ixi-O Agent VoiceOps Bridge`.
3. Paste `miso/ixi-o-agent-openapi.v3.json` first. If MISO accepts OpenAPI 3.1,
   `miso/ixi-o-agent-openapi.json` is also available.
4. Replace `servers[0].url` before pasting:
   - local-only gateway test: `http://localhost:3321`
   - cloud MISO calling local Mac: current gateway Cloudflare Tunnel URL
   - helper:
     `pnpm miso:openapi:v3 https://<trycloudflare-host>`
5. Set auth as Bearer Token with `IXI_O_AGENT_MISO_GATEWAY_TOKEN`, not the
   long-lived local ingest secret.
6. Import sub-tools and test:
   - `listVoiceSessions`
   - `readVoiceSessionHandoff`
7. Capture the tool test result and app share state in
   `docs/miso-submit-evidence.md` before final judging.
8. If the tunnel or token changes, update the existing MISO custom tool schema
   and auth token before running the live app. Cloudflare quick tunnels are
   ephemeral and the current live URL will break after restart.

Expected behavior:

- Before review: metadata is visible, handoff payload is blocked.
- After review: MISO can read only redacted payload. Raw audio and raw
  transcript are never returned.

### 2. Import the MISO App Draft

1. Open `플레이그라운드` -> `앱 리스트`.
2. Click `앱 만들기` -> `기존 앱 가져오기`.
3. Upload `miso/apps/ixi-o-agent-voiceops-copilot.yml`.
4. Open the imported app.
5. Add the custom tool from step 1 to the app tools.
6. Save and share.

If the imported app cannot bind the custom tool automatically, keep the prompt
and manually add the tool in the app editor.

### 3. Document MCP Grounding

Register the official MISO Document MCP from the guide if time allows:

```json
{
  "miso-doc-mcp": {
    "url": "https://3.36.78.231.sslip.io/mcp",
    "transport": "streamable-http"
  }
}
```

Use it to ground answers about MISO limitations and setup paths.

Judging-safe positioning:

- If Document MCP is attached live, say: "The MISO app can search MISO docs for
  setup and limitation questions before answering."
- If it is not attached live, say: "The implementation was designed from the
  MISO guide and track deck, and the Document MCP registration path is prepared;
  the core app demo does not depend on it."
- Do not pretend Document MCP is live if it is not visible in the app tool list.

## Demo Scenarios

### Scenario A: Live Custom Tool Pull

User prompt in MISO:

```text
승인된 voice session 목록을 보고 가장 최근 고객 이슈를 업무 카드로 정리해 주세요.
```

Expected MISO output:

- 업무 카드 title, request type, urgency, required teams
- 3-5 next actions
- human review reason
- current integration path: MISO pulls ixi-O Agent redacted handoff by custom tool
- next interface proposal: inbound voice-session event or MCP resource ingest

### Scenario B: Fallback JSON Paste

If tool auth/tunnel fails, paste:

```text
아래 redacted handoff JSON을 MISO 업무 액션으로 바꿔 주세요.
```

Then paste `miso/samples/approved-voice-session-handoff.sample.json`.

This still demonstrates the business workflow and the safe handoff shape.

### Scenario C: Review Gate

Paste `miso/samples/blocked-voice-session-detail.sample.json`.

Expected MISO output:

- external workflow access is blocked
- human review is required
- no raw audio/transcript is available
- next action is to approve/reject in the local ixi-O Agent review screen

### Scenario D: Document MCP / Product Constraint Question

If the official `miso-doc-mcp` tool is attached, ask:

```text
MISO에서 외부 REST API를 custom tool로 등록하려면 어떤 절차와 제약이 있나요?
```

Expected output:

- use `search_docs` / `fetch_doc` first
- explain `플레이그라운드 -> 도구 모음 -> 사용자 정의`
- mention OpenAPI 3.x, operationId, authentication, tool test, save/share/publish
- then connect that limitation to ixi-O Agent's custom-tool pull approach

If Document MCP is not attached, skip this live demo and use
`miso/miso-doc-mcp-registration.json` plus the local guide source as proof of
the prepared grounding path.

## Judging Script

1. Show `https://ixi-o-agent.vercel.app`.
2. Explain Enterprise mode: Channel Talk -> Mac mini M4 local processing ->
   Whisper STT -> EXAONE summary -> PII masking -> decision-only handoff.
3. Open local app and show a session detail page.
4. Show that raw transcript stays local.
5. Show review gate.
6. Show MISO app reading approved redacted payload or fallback JSON.
7. Show MISO output as an enterprise workflow card.
8. Show the interface gap:
   - What works now: custom tool pull, MCP tool direction.
   - What MISO should expose next: inbound voice-session event and/or MCP
     resource ingest.

## What To Emphasize

- This is not a generic chatbot. It handles request classification, urgency,
  owner team, next action, review/approval, and interface gaps.
- The privacy boundary is deliberate: raw voice context stays local.
- MISO is positioned as the enterprise workflow runtime, not raw voice storage.
- The proposal is useful to GS Neotek because it names the missing interface in
  a concrete schema they can evaluate.

## MISO-Side Security Observations To Verify

Do not treat these as confirmed vulnerabilities without MISO operator context.
For judging, present them as product/security hardening questions that surfaced
while integrating a privacy-sensitive voice workflow.

- Custom tool secrets: if Bearer Token values are stored workspace-wide, MISO
  should make masking, rotation, owner visibility, and audit logs explicit.
  Confirm whether broad visibility is relaxed only for the hackathon workspace.
- Public/external sharing: MISO supports wider sharing scopes. For voice-derived
  workflow apps, external/public sharing should warn when tools can reach
  private local tunnels or sensitive APIs.
- Quick tunnel endpoints: Cloudflare quick tunnels are useful for demos but
  ephemeral and not production-grade. MISO could label them as demo-only or
  recommend named tunnels/private network connectors for real deployments.
- Inbound event proposal: if MISO later adds a `voice-session.created` inbound
  API, require per-app scoped tokens, replay protection, idempotency keys, and
  payload size limits by default.

## Support Question Template

Use this if MISO setup blocks the live custom-tool path:

```text
- 질문자/팀명: man2service / ixi-O Agent
- 질문유형: 사용 방법 문의
- 기능명: 커스텀 도구 / OpenAPI / 앱 발행
- 상세 내용:
  MISO 앱에서 ixi-O Agent의 OpenAPI custom tool을 등록해
  listVoiceSessions/readVoiceSessionHandoff를 호출하려고 합니다.
  OpenAPI 등록 또는 Bearer Token 인증/Cloudflare Tunnel URL 호출에서 막힙니다.
  현재 구현은 MISO가 외부 REST tool을 pull하는 방식이며,
  별도로 inbound voice-session event schema를 제안하고 있습니다.
- 스크린샷(옵션): 도구 등록 화면, 하위 도구 가져오기 결과, 테스트 오류 화면
```

## Preflight

```bash
git status --short
node -e "for (const f of ['miso/ixi-o-agent-openapi.json','miso/ixi-o-agent-openapi.v3.json','miso/mcp-tool-proposal.json','miso/proposed-inbound-voice-event.schema.json','miso/samples/approved-voice-session-handoff.sample.json','miso/samples/blocked-voice-session-detail.sample.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok')"
ruby -e "require 'yaml'; YAML.load_file('miso/apps/ixi-o-agent-voiceops-copilot.yml'); puts 'ok'"
pnpm smoke:local
```

Tunnel exposure check before MISO registration:

```bash
curl -i "$TUNNEL_URL/"
curl -i "$TUNNEL_URL/api/sessions"
curl -i "$TUNNEL_URL/api/miso/voice-sessions"
curl -i -H "Authorization: Bearer wrong" "$TUNNEL_URL/api/miso/voice-sessions"
curl -i -H "Authorization: Bearer $IXI_O_AGENT_MISO_GATEWAY_TOKEN" "$TUNNEL_URL/api/miso/voice-sessions"
```

Expected:

- `/` and `/api/sessions`: `404`
- MISO API with no or wrong token: `401`
- MISO API with gateway token: `200`

Do not use real customer raw transcripts for the public demo.
