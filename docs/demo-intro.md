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

## What To Show

- Dashboard: collected Channel Talk sessions
- Session detail: raw transcript stays local
- EXAONE output: summary and action items generated locally
- Review controls: external handoff is blocked until approval
- MISO proposal API: metadata first, payload only after review
- n8n: realtime webhook, polling backup, and manual historical backfill

## Why It Fits OBA

- LG U+ track: Voice AI use case with EXAONE in the pipeline
- GS Neotek/MISO track: proposes a safe inbound handoff pattern for agent workflows
- Privacy story: STT/LLM post-processing can run on local hardware; raw transcript does not need to leave the operator machine

## Extension Line

ixi-O 통화와 연동하여 더 강력해져요
