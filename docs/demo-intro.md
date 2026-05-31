# ixi-O Agent Demo Intro

## Tagline

일상의 모든 Voice를, 에이전트와 함께

## One-liner

ixi-O Agent turns calls and meetings into private local agent context, then opens only reviewed, redacted task payloads to workflow tools.

## Demo Flow

```text
1. Channel Talk phone/user-chat history enters n8n.
2. n8n sends the event or backfilled messages into the local ixi-O Agent bridge.
3. ixi-O Agent stores raw source, transcript, and agent draft files under private-voice-inbox.
4. The local web UI opens a session detail page.
5. EXAONE local processing creates a summary, urgency, teams, and action items.
6. A human reviews the output.
7. Only the redacted MISO handoff payload becomes available to external workflow tools.
```

## 3-Minute Demo Script

1. Open `https://ixi-o-agent.vercel.app` and show the Enterprise experience flow: Channel Talk, local AI, masking, agent-folder handoff.
2. Switch to Personal mode and show full transcript plus summary handoff without enterprise masking.
3. Open `http://localhost:3000` and show the real local inbox.
4. Show the `Private Mode` local input form as the non-Channel Talk meeting/voice path.
5. Open the synthetic proof session `20260530T153141_utc_channel_talk_e7b435ae0b`.
6. Show that the raw transcript is visible only in the local review screen.
7. Show `EXAONE: exaone-local` and the generated agent-ready output.
8. Show `MISO: 승인됨` and explain that the external API returns only the reviewed redacted payload.

This proof session was created from a synthetic Channel Talk user chat, not a real customer conversation.

## What To Show

- Public experience page: Enterprise and Personal flows with visible step completion
- Dashboard: collected Channel Talk sessions
- Private Mode form: local meeting transcript/audio input without Channel Talk
- Session detail: raw transcript stays local
- EXAONE output: summary and action items generated locally
- Review controls: external handoff is blocked until approval
- MISO proposal API: metadata first, payload only after review
- MISO proposal files: `miso/proposed-miso-interfaces.md` and `miso/proposed-inbound-voice-event.schema.json`
- n8n: realtime webhook, polling backup, and manual historical backfill

## Local Verification Commands

```bash
pnpm typecheck
pnpm build

set -a; source .env.local; set +a
curl -fsS http://localhost:3000/api/sessions
curl -fsS \
  -H "x-ixi-o-agent-ingest-secret: $IXI_O_AGENT_INGEST_SECRET" \
  http://localhost:3000/api/miso/voice-sessions/20260530T153141_utc_channel_talk_e7b435ae0b
pnpm smoke:local
```

When running `pnpm build`, stop the Next dev server first. Running build and dev against the same `.next` directory can make the dev server hold stale chunk references.

## Why It Fits OBA

- LG U+ track: Voice AI use case with EXAONE in the pipeline
- GS Neotek/MISO track: proposes a safe inbound handoff pattern for agent workflows
- Privacy story: STT/LLM post-processing can run on local hardware; raw transcript does not need to leave the operator machine

## Extension Line

ixi-O 통화와 연동하여 더 강력해져요
