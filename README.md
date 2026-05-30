# Phone-Claw

일상의 모든 Voice를, 에이전트와 함께.

Phone-Claw is a private local voice bridge for the OBA Weekend-thon S1 build. It turns call, meeting, and voice-note context into local agent-ready files, then prepares redacted handoff payloads for workflow tools such as MISO.

## Current MVP

- Channel Talk Open API backfill into local voice sessions
- n8n workflows for sample ingest, webhook ingest, polling, and manual backfill
- Local Next.js dashboard and session review screen for collected sessions
- Storage contract under `private-voice-inbox/sessions`
- Local STT small model and EXAONE 1.2B GGUF smoke-tested on the Mac mini M4
- Local EXAONE post-processing button for summaries, urgency, teams, and action items
- Restricted MISO-facing API/OpenAPI draft that exposes only reviewed, redacted handoff payloads

## Demo Path

```text
Channel Talk -> n8n -> Phone-Claw local inbox -> EXAONE local processing
  -> human review -> redacted MISO handoff proposal
```

The first screen is the local inbox. Click any stored session to open the detail/review view.

## Local Development

```bash
pnpm install
PHONE_CLAW_INGEST_SECRET=dev-secret PHONE_CLAW_STORAGE_DIR=./private-voice-inbox pnpm dev
```

Open:

```text
http://localhost:3000
```

## Docs

- n8n setup: `docs/n8n/local-docker.md`
- Channel Talk realtime webhook: `docs/channel-talk-webhook.md`
- Local models: `docs/local-models.md`
- Demo intro: `docs/demo-intro.md`
- MISO custom tool draft: `miso/README.md`

## Security

Do not commit local credentials, raw call data, generated voice sessions, model files, or n8n runtime data. The repo is configured to ignore `.env.local`, `private-voice-inbox/`, `n8n-data/`, `n8n-data-v1/`, and `models/`.
