# Phone-Claw

일상의 모든 Voice를, 에이전트와 함께.

Phone-Claw is a private local voice bridge for the OBA Weekend-thon S1 build. It turns call, meeting, and voice-note context into local agent-ready files, then prepares redacted handoff payloads for workflow tools such as MISO.

## Current MVP

- Channel Talk Open API backfill into local voice sessions
- n8n workflow drafts for sample ingest, webhook ingest, polling, and manual backfill
- Local Next.js dashboard for collected sessions
- Storage contract under `private-voice-inbox/sessions`
- Planned local STT + EXAONE post-processing pipeline

## Local Development

```bash
pnpm install
PHONE_CLAW_INGEST_SECRET=dev-secret PHONE_CLAW_STORAGE_DIR=./private-voice-inbox pnpm dev
```

Open:

```text
http://localhost:3000
```

## Security

Do not commit local credentials, raw call data, generated voice sessions, model files, or n8n runtime data. The repo is configured to ignore `.env.local`, `private-voice-inbox/`, and `n8n-data/`.
