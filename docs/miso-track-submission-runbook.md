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

- MISO apps must be saved and published before judges/team members can run the
  latest version.
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
- MISO custom tool OpenAPI: `miso/ixi-o-agent-openapi.json`
- Approved fallback payload: `miso/samples/approved-voice-session-handoff.sample.json`
- Blocked-before-review payload: `miso/samples/blocked-voice-session-detail.sample.json`
- Interface proposal docs:
  - `miso/proposed-miso-interfaces.md`
  - `miso/proposed-inbound-voice-event.schema.json`
  - `miso/mcp-tool-proposal.json`

## MISO Workspace Setup

### 1. Register the Custom Tool

1. Open `플레이그라운드` -> `도구 모음` -> `사용자 정의`.
2. Create a custom tool named `ixi-O Agent Restricted Voice Session Tool`.
3. Paste `miso/ixi-o-agent-openapi.json`.
4. Replace `servers[0].url` before pasting:
   - local-only test: `http://localhost:3000`
   - cloud MISO calling local Mac: current Cloudflare Tunnel URL
5. Set auth as Bearer Token with the local `IXI_O_AGENT_INGEST_SECRET`.
6. Import sub-tools and test:
   - `listVoiceSessions`
   - `readVoiceSessionHandoff`

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
6. Save and publish.

If the imported app cannot bind the custom tool automatically, keep the prompt
and manually add the tool in the app editor.

### 3. Optional Document MCP

Register the official MISO Document MCP from the guide if time allows:

```json
{
  "miso-doc-mcp": {
    "url": "https://3.36.78.231.sslip.io/mcp",
    "transport": "streamable-http"
  }
}
```

Use it to ground answers about MISO limitations and setup paths. Do not spend
too much time here if the main demo path is not yet stable.

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
node -e "for (const f of ['miso/ixi-o-agent-openapi.json','miso/mcp-tool-proposal.json','miso/proposed-inbound-voice-event.schema.json','miso/samples/approved-voice-session-handoff.sample.json','miso/samples/blocked-voice-session-detail.sample.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok')"
ruby -e "require 'yaml'; YAML.load_file('miso/apps/ixi-o-agent-voiceops-copilot.yml'); puts 'ok'"
pnpm smoke:local
```

Do not use real customer raw transcripts for the public demo.
