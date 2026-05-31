# Proposed MISO Interfaces

ixi-O Agent treats MISO as the enterprise workflow runtime, not as raw voice
storage. The current hackathon build therefore separates what already works
from what we propose MISO should expose next.

## Implemented Now: MISO Calls ixi-O Agent

MISO can register ixi-O Agent as a custom REST tool with
`ixi-o-agent-openapi.json`.

Available operations:

- `listVoiceSessions`: read metadata for local voice sessions.
- `readVoiceSessionHandoff`: read a redacted handoff payload only after human
  review allows external workflow access.

This path is pull-based: MISO calls the local ixi-O Agent tool. ixi-O Agent does
not push raw audio, raw transcripts, or unreviewed customer content into MISO.

## Proposed Next: Inbound Voice Event

MISO would become stronger for call-center and meeting workflows if it exposed
a first-class inbound event such as:

```http
POST /miso/events/voice-session.created
Authorization: Bearer <miso-event-token>
Content-Type: application/json
```

Payload schema:

- `proposed-inbound-voice-event.schema.json`

The event is deliberately narrow:

- `sourceSystem`: `channel_talk` or `local_voice`
- `sourceMode`: `call`, `meeting`, or `voice_note`
- `summary`, `urgency`, `requiredTeams`, `actionItems`
- `sourceRefs` for traceability back to the source system
- no raw audio
- no raw transcript
- human review required before external workflow delivery

## Proposed MCP Shape

`mcp-tool-proposal.json` describes a local MCP bridge where MISO can list
approved voice sessions, read a redacted handoff, and prepare a case-creation
request. This follows the same security rule as the custom REST tool: metadata
first, payload only after review.

## Security Product Suggestions For MISO

These are not claims of confirmed vulnerabilities. They are security/product
checks that matter once voice-derived business context is connected to MISO.

- Make custom tool credential scope and visibility explicit. If a hackathon
  workspace temporarily relaxes visibility, label that separately from normal
  production behavior.
- Add audit logs for custom tool creation, credential changes, sub-tool import,
  app save, app publish, and external sharing changes.
- Warn before publishing or externally sharing an app that can call a private
  tunnel or sensitive internal API.
- If MISO adds inbound voice-session ingest, require scoped event tokens, replay
  protection, idempotency keys, and payload size limits.
- Distinguish demo connectivity such as quick Cloudflare tunnels from
  production connectivity such as named tunnels, allowlists, or private network
  connectors.

## Workflow MISO Could Automate

Given an approved ixi-O Agent payload, a MISO app could:

1. Classify the customer or meeting request.
2. Pick an SOP or owner team.
3. Draft a ticket, follow-up message, or internal task.
4. Ask a human to approve the next action.

ixi-O Agent's job is to make voice context safe and structured enough for that
workflow. MISO's job is to execute the enterprise action.

## Verification

Validate the proposal files:

```bash
node -e "for (const f of ['miso/ixi-o-agent-openapi.json','miso/mcp-tool-proposal.json','miso/proposed-inbound-voice-event.schema.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok')"
```

Inspect the implemented pull API locally:

```bash
curl -fsS \
  -H "Authorization: Bearer $IXI_O_AGENT_INGEST_SECRET" \
  http://localhost:3000/api/miso/voice-sessions
```

Before review, the detail API returns a blocked reason. After review, it
returns the redacted payload with:

```json
{
  "rawTranscriptIncluded": false,
  "rawAudioIncluded": false,
  "humanReviewRequired": true,
  "redactionApplied": true
}
```
