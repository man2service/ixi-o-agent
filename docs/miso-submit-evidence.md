# MISO Submit Evidence

Updated: 2026-05-31 KST

This file records what can be shown to GS Neotek / MISO judges without exposing
secrets or raw customer content.

## Current Evidence

| Item | Status | Evidence |
| --- | --- | --- |
| App import draft | Ready | `miso/apps/ixi-o-agent-voiceops-copilot.yml` parses as YAML |
| Custom REST tool schema | Ready | `miso/ixi-o-agent-openapi.v3.json` and `miso/ixi-o-agent-openapi.json` parse as JSON |
| Tool operations | Ready | `listVoiceSessions`, `readVoiceSessionHandoff` |
| Gateway isolation | Ready | `scripts/miso-tool-gateway.mjs` exposes only MISO GET paths |
| Gateway token policy | Ready | gateway requires explicit `IXI_O_AGENT_MISO_GATEWAY_TOKEN` and fails closed when missing |
| Review gate | Ready | `pnpm smoke:local` verifies blocked-before-review and available-after-review behavior |
| Fallback approved payload | Ready | `miso/samples/approved-voice-session-handoff.sample.json` |
| Fallback blocked payload | Ready | `miso/samples/blocked-voice-session-detail.sample.json` |
| Proposed inbound interface | Ready | `miso/proposed-inbound-voice-event.schema.json` |
| Proposed MCP shape | Ready | `miso/mcp-tool-proposal.json` |

## Workspace Evidence To Capture During Final Rehearsal

Add screenshots or short notes here after using the live MISO workspace:

```text
Workspace:
App URL:
Custom tool name:
OpenAPI server URL:
Sub-tools imported:
listVoiceSessions test result:
readVoiceSessionHandoff test result:
App saved:
App published:
Prompt used:
Observed MISO answer:
```

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

1. Register `ixi-O Agent VoiceOps Bridge` as a custom OpenAPI tool.
2. Set Bearer Token auth to the short-lived `IXI_O_AGENT_MISO_GATEWAY_TOKEN`.
3. Add the tool to the imported app.
4. Save and publish.

## Security/Platform Proposal For Judges

Position this as product hardening, not as a confirmed vulnerability:

- Custom tool secrets should have visible owner, masking, rotation, and audit logs.
- Apps that can call private tunnels should warn before external sharing.
- Quick tunnels should be labeled demo-only; production should use named tunnels,
  private connectors, or allowlisted endpoints.
- A future MISO `voice-session.created` inbound event should require scoped
  tokens, replay protection, idempotency keys, and payload size limits.
