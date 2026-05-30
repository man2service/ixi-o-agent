# Phone-Claw

일상의 모든 Voice를, 에이전트와 함께.

Phone-Claw is a private local voice bridge for the OBA Weekend-thon S1 build. It turns call, meeting, and voice-note context into local agent-ready files, then prepares redacted handoff payloads for workflow tools such as MISO.

## Current MVP

- Channel Talk Open API backfill into local voice sessions
- Channel Talk realtime webhook proof through Cloudflare Tunnel and n8n
- Local private voice frontdoor for pasted meeting/call transcripts and optional local audio files
- n8n workflows for sample ingest, webhook ingest, polling, and manual backfill
- Local Next.js dashboard with demo golden-path status and session review screen
- Storage contract under `private-voice-inbox/sessions`
- Local STT small model and EXAONE 1.2B GGUF smoke-tested on the Mac mini M4
- Local EXAONE post-processing for summaries, urgency, teams, and action items
- Restricted MISO-facing API/OpenAPI draft that exposes only reviewed, redacted handoff payloads

## Demo Path

```text
Channel Talk or Local Voice -> Phone-Claw local inbox -> EXAONE local processing
  -> human review -> redacted MISO handoff proposal
```

The first screen is the local inbox. Click any stored session to open the detail/review view.

Current synthetic full-path proof session:

```text
20260530T153141_utc_channel_talk_e7b435ae0b
```

That session demonstrates realtime Channel Talk ingest, EXAONE local processing, human approval, and MISO redacted payload availability without using a real customer conversation.

For the judging-oriented summary, demo script, sponsor fit, architecture diagram, and limitations, see `docs/submission-pack.md`.

## Local Development

Fresh Apple Silicon Mac:

```bash
git clone https://github.com/man2service/Phoneclaw.git
cd Phoneclaw
brew install fnm
fnm install 20.20.2
fnm use 20.20.2
corepack enable
pnpm install
cp .env.example .env.local
```

Edit `.env.local` locally. Do not commit it. At minimum, set:

```text
PHONE_CLAW_STORAGE_DIR=./private-voice-inbox
PHONE_CLAW_INGEST_SECRET=<random-local-secret>
N8N_ENCRYPTION_KEY=<random-local-secret>
```

Run:

```bash
set -a; source .env.local; set +a
pnpm dev
```

Open:

```text
http://localhost:3000
```

Seed a local sample session without Channel Talk credentials:

```bash
set -a; source .env.local; set +a
pnpm test:ingest
```

Build verification:

```bash
pnpm typecheck
pnpm build
```

Stop the Next dev server before `pnpm build`; both commands write/read `.next`, and running them at the same time can leave the dev server with stale chunk references.

Run the local black-box smoke test without any external credentials:

```bash
pnpm smoke:local
```

This starts a temporary Next dev server on port `3210`, uses an isolated temp storage folder, ingests the sample payload, runs fallback-local processing with a deliberately missing model path, verifies MISO blocks before review, approves the synthetic session, then verifies the redacted payload becomes available.

The smoke test also creates one `local_voice_upload` meeting session through `POST /api/ingest/local-voice`.

For M1 MacBook setup, local model downloads, and n8n instructions, see `docs/m1-macbook-setup.md`.

## Docs

- M1 MacBook setup: `docs/m1-macbook-setup.md`
- n8n setup: `docs/n8n/local-docker.md`
- Channel Talk realtime webhook: `docs/channel-talk-webhook.md`
- Local models: `docs/local-models.md`
- Demo intro: `docs/demo-intro.md`
- Submission pack: `docs/submission-pack.md`
- MISO custom tool/proposal pack: `miso/README.md`

## Security

Do not commit local credentials, raw call data, generated voice sessions, model files, or n8n runtime data. The repo is configured to ignore `.env.local`, `private-voice-inbox/`, `n8n-data/`, `n8n-data-v1/`, and `models/`.
