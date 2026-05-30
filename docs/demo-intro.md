# Phone-Claw Demo Intro

## Tagline

일상의 모든 Voice를, 에이전트와 함께

## One-liner

Phone-Claw turns calls and meetings into private local agent context, then opens only reviewed, redacted task payloads to workflow tools.

## Demo Flow

```text
1. Channel Talk phone/user-chat history enters n8n.
2. n8n sends the event or backfilled messages into the local Phone-Claw bridge.
3. Phone-Claw stores raw source, transcript, and agent draft files under private-voice-inbox.
4. The local web UI opens a session detail page.
5. EXAONE local processing creates a summary, urgency, teams, and action items.
6. A human reviews the output.
7. Only the redacted MISO handoff payload becomes available to external workflow tools.
```

## 3-Minute Demo Script

1. Open `http://localhost:3000` and show the four-step golden path: Voice 수집, EXAONE 후처리, Human Review, MISO 제안.
2. Show the `Private Mode` local input form as the non-Channel Talk meeting/voice path.
3. Open the synthetic proof session `20260530T153141_utc_channel_talk_e7b435ae0b`.
4. Show that the raw transcript is visible only in the local review screen.
5. Show `EXAONE: exaone-local` and the generated agent-ready output.
6. Show `MISO: 승인됨` and explain that the external API returns only the reviewed redacted payload.

This proof session was created from a synthetic Channel Talk user chat, not a real customer conversation.

## What To Show

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
  -H "x-phone-claw-ingest-secret: $PHONE_CLAW_INGEST_SECRET" \
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
