# ixi-O Agent

일상의 모든 Voice를, 에이전트와 함께.

ixi-O Agent is a private local voice bridge for the OBA Weekend-thon S1 build. It turns call, meeting, and voice-note context into local agent-ready files, then prepares redacted handoff payloads for workflow tools such as MISO.

## Current MVP

- Channel Talk Open API backfill into local voice sessions
- Channel Talk realtime webhook proof through Cloudflare Tunnel and n8n
- Local private voice frontdoor for pasted meeting/call transcripts, browser microphone recording, and optional local audio files
- n8n workflows for sample ingest, webhook ingest, polling, and manual backfill
- Local Next.js dashboard with demo golden-path status and session review screen
- Storage contract under `IXI_O_AGENT_STORAGE_DIR/sessions`
- Local STT small model and EXAONE 1.2B GGUF smoke-tested on the Mac mini M4
- Local EXAONE post-processing for summaries, urgency, teams, and action items
- Restricted MISO-facing API/OpenAPI draft that exposes only reviewed, redacted handoff payloads
- Kiya/Hermes outbound summary after EXAONE processing, plus a separate calendar-confirmation prompt when a calendar-worthy follow-up is detected
- Per-session Kiya notification log under `agent/kiya-notification.latest.json` for demo review even when Telegram credentials are absent
- Kiya/Hermes calendar result audit callback under `POST /api/sessions/{sessionId}/kiya-calendar-result`

## Demo Path

```text
Channel Talk or Local Voice -> ixi-O Agent local inbox -> EXAONE local processing
  -> Kiya summary -> optional Kiya calendar confirmation -> human review -> redacted MISO handoff proposal
```

Experience modes:

- Enterprise: Channel Talk voice data is processed on the Mac mini M4 local server with Whisper STT and EXAONE summarization, then PII is masked before decision-only handoff to agent folders.
- Personal: local meeting/call recordings are processed privately with Whisper STT and EXAONE, then the full transcript and summary can be handed to the user's personal agent without masking.
- FriendliAI is treated as an optional hosted inference path, not the default privacy path. Add a Friendli Personal API Key only when implementing hosted STT/LLM calls.

Public Vercel showcase:

```text
https://ixi-o-agent.vercel.app
```

The Vercel page is a safe submission mockup. It does not include raw
transcripts, local model execution, Channel Talk credentials, or customer data.

## Design System

The public showcase and local `/showcase` page now use a TDS-inspired interaction system implemented with ixi-O Agent's own CSS tokens and components.

- Button hierarchy separates primary fill actions from quieter weak actions.
- Badges show short processing/review/handoff states.
- ListRow-style rows show source artifacts, meaning, and current status in one scan path.
- Enterprise/Personal switching follows a segmented-control pattern.
- Brand colors are isolated in `--brand-*` CSS variables so the visual identity can be changed later without rewriting component styles.
- Current visual materials use an LG U+ / ixi-O-inspired palette: LG RED as the primary anchor, restrained digital purple as a secondary accent, and neutral TDS-like surfaces for readability.

We do not copy or import Toss UI Kit assets. See `docs/tds-inspired-design-system.md` for source links, license boundary, and token locations.

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
git clone https://github.com/man2service/ixi-o-agent.git
cd ixi-o-agent
brew install fnm
fnm install 20.20.2
fnm use 20.20.2
corepack enable
pnpm install
cp .env.example .env.local
```

The repo includes `.node-version` with `20.20.2`; run `fnm use` in new shells
before local verification if `node -v` points to a different version.

Edit `.env.local` locally. Do not commit it. At minimum, set:

```text
IXI_O_AGENT_STORAGE_DIR=./private-voice-inbox
IXI_O_AGENT_INGEST_SECRET=<random-local-secret>
N8N_ENCRYPTION_KEY=<random-local-secret>
```

Optional hosted inference:

```text
FRIENDLI_TOKEN=<friendli-personal-api-key>
```

Only set `FRIENDLI_TOKEN` if you intentionally enable FriendliAI hosted
Whisper/EXAONE calls. The local-first demo does not need it.

Existing `PHONE_CLAW_*` environment variables and `x-phone-claw-ingest-secret`
headers are still accepted as legacy aliases, but new setups should use
`IXI_O_AGENT_*` and `x-ixi-o-agent-ingest-secret`.

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
It verifies Kiya/Hermes notification dry-run behavior when Telegram credentials are absent, including the persisted notification log and the separate calendar proposal message for calendar-worthy sessions.

Check local STT with the installed Whisper small model:

```bash
pnpm check:stt
```

For M1 MacBook setup, local model downloads, and n8n instructions, see `docs/m1-macbook-setup.md`.

## Docs

- M1 MacBook setup: `docs/m1-macbook-setup.md`
- n8n setup: `docs/n8n/local-docker.md`
- Channel Talk realtime webhook: `docs/channel-talk-webhook.md`
- Demo operations runbook: `docs/demo-ops-runbook.md`
- MISO judging runbook: `docs/miso-track-submission-runbook.md`
- Local models: `docs/local-models.md`
- STT field validation: `docs/stt-field-validation.md`
- Demo intro: `docs/demo-intro.md`
- Submission pack: `docs/submission-pack.md`
- TDS-inspired design system: `docs/tds-inspired-design-system.md`
- MISO custom tool/proposal pack: `miso/README.md`
- Telegram Kiya research: `docs/telegram-kiya-integration-research.md`

## Security

Do not commit local credentials, raw call data, generated voice sessions, model files, or n8n runtime data. The repo is configured to ignore `.env.local`, `private-voice-inbox/`, `n8n-data/`, `n8n-data-v1/`, and `models/`.
