# MISO Submit Evidence

Updated: 2026-05-31 KST

This file records what can be shown to GS Neotek / MISO judges without exposing
secrets or raw customer content.

## Current Evidence

| Item | Status | Evidence |
| --- | --- | --- |
| App import draft | Ready | `miso/apps/ixi-o-agent-voiceops-copilot.yml` parses as YAML |
| Live MISO app | Verified | `ixi-O Agent VoiceOps Copilot` exists in `럭키밀 (모난돌컴퍼니) Team` |
| Live MISO share setting | Verified | App is shared as `현재 워크스페이스 공개` |
| Live MISO app URL | Verified | `https://console.miso.gs/chatList/T4JZ5CTOJpifUz3L` |
| Live custom tool binding | Verified | `ixi-O Agent VoiceOps Bridge` is attached to the app as `2/2` tools |
| Custom REST tool schema | Ready | `miso/ixi-o-agent-openapi.v3.json` and `miso/ixi-o-agent-openapi.json` parse as JSON |
| Tool operations | Verified | `listVoiceSessions`, `readVoiceSessionHandoff` imported and tested in MISO |
| Gateway isolation | Ready | `scripts/miso-tool-gateway.mjs` exposes only MISO GET paths |
| Gateway token policy | Ready | gateway requires explicit non-placeholder `IXI_O_AGENT_MISO_GATEWAY_TOKEN` and fails closed when missing |
| Live app prompt | Verified | MISO chat generated a business card and next actions from approved voice sessions |
| Review gate | Ready | `pnpm smoke:local` verifies blocked-before-review and available-after-review behavior |
| Fallback approved payload | Ready | `miso/samples/approved-voice-session-handoff.sample.json` |
| Fallback blocked payload | Ready | `miso/samples/blocked-voice-session-detail.sample.json` |
| Proposed inbound interface | Ready | `miso/proposed-inbound-voice-event.schema.json` |
| Proposed MCP shape | Ready | `miso/mcp-tool-proposal.json` |

## Live Workspace Evidence

Captured at 2026-05-31 12:57 KST.

- Workspace: `럭키밀 (모난돌컴퍼니) Team`
- App name: `ixi-O Agent VoiceOps Copilot`
- App config URL: `https://console.miso.gs/app-config/chat/a61da945-3cf7-466a-b8fe-c59a48ea07e9`
- App runtime URL: `https://console.miso.gs/chatList/T4JZ5CTOJpifUz3L`
- App share setting: `현재 워크스페이스 공개`
- Custom tool name: `ixi-O Agent VoiceOps Bridge`
- Current demo gateway URL: `https://<trycloudflare-host>`
- Current live OpenAPI schema snapshot:
  `docs/evidence/miso/ixi-o-agent-openapi.current-tunnel.v3.json`
- Sub-tools imported: `listVoiceSessions`, `readVoiceSessionHandoff`
- `listVoiceSessions` MISO tool test: returned `ok: true` with 67 sessions.
- `readVoiceSessionHandoff` MISO tool test: returned `ok: true` for
  `20260531T023933_utc_local_voice_1fa0e9c632`.
- Handoff safety result: status was `approved_for_external_workflow`,
  `redactionApplied: true`, `rawTranscriptIncluded: false`,
  `rawAudioIncluded: false`, and `humanReviewRequired: true`.
- App runtime prompt used:
  `승인된 voice session 목록을 보고 업무 카드로 정리해 주세요.`
- Observed MISO answer: the app found 3 approved sessions and produced a
  business card for an OBA submission check meeting, including scheduling next
  action, human review requirement, and MISO interface proposal.

Screenshots:

- [MISO custom tool sub-tools](evidence/miso/miso-custom-tool-subtools.jpg)
- [MISO listVoiceSessions tool test](evidence/miso/miso-tool-test-list-voice-sessions.jpg)
- [MISO readVoiceSessionHandoff tool test](evidence/miso/miso-tool-test-read-session-handoff.jpg)
- [MISO share setting](evidence/miso/miso-app-share-current-workspace.jpg)
- [MISO runtime tool answer](evidence/miso/miso-app-runtime-tool-answer.jpg)

Do not capture or paste:

- Bearer token values
- `.env.local`
- raw transcript text
- raw audio
- customer names, phone numbers, emails, or account identifiers

## Manual Tool Binding Note

The MISO app YAML currently contains `tools: []`. This is expected for the
export/import draft because the app prompt and model configuration are portable,
but the custom-tool credential binding is workspace-specific.

Final live setup still requires:

1. Keep `pnpm miso:gateway` running on the Mac mini.
2. Keep the current tunnel running, or regenerate the OpenAPI server URL with
   `pnpm miso:openapi:v3 https://<trycloudflare-host>`.
3. If the tunnel changes, update the existing MISO custom tool schema and test
   `listVoiceSessions` and `readVoiceSessionHandoff` again.
4. Do not paste or commit the bearer token. The live token is short-lived and
   belongs outside the repository.
5. The app YAML is a prompt/model draft only. The live custom-tool credential
   binding is a workspace-specific MISO setting and is verified by the evidence
   screenshots above.

## Security/Platform Proposal For Judges

Position this as product hardening, not as a confirmed vulnerability:

- Custom tool secrets should have visible owner, masking, rotation, and audit logs.
- Apps that can call private tunnels should warn before external sharing.
- Quick tunnels should be labeled demo-only; production should use named tunnels,
  private connectors, or allowlisted endpoints.
- A future MISO `voice-session.created` inbound event should require scoped
  tokens, replay protection, idempotency keys, and payload size limits.
