# User Prep Checklist For Long Agent Run

Updated: 2026-05-30

Purpose: before running OpenCode/oh-my-openagent or another long-running agent, separate what the user must prepare from what the agent can implement.

## Current Readiness

Already available on this machine:

- Node.js v20.20.2
- pnpm 9.15.0
- Docker 29.2.1
- Docker Compose v5.0.2
- `whisper-cli` at `/opt/homebrew/bin/whisper-cli`
- OpenCode binary at `/Users/bot_mandu/.opencode/bin/opencode`, version 1.15.12

Not currently on `PATH`:

- `opencode`

Use the full path:

```bash
cd /Users/bot_mandu/Documents/ixi-O Agent
/Users/bot_mandu/.opencode/bin/opencode run 'ultrawork 현재 폴더의 문서를 읽고 ixi-O Agent MVP를 구현해줘. 기존 변경은 되돌리지 말고, 테스트 가능한 작은 단계로 진행해줘.'
```

Or add this to the shell session before running:

```bash
export PATH="$HOME/.opencode/bin:$PATH"
```

Not installed or not found:

- `ngrok`
- `cloudflared`
- `ollama`
- `llama-cli`
- `n8n` CLI

Docker is available, so n8n CLI is not required for the current plan.

## Credentials And Accounts The User Should Prepare

### 1. Channel Talk

Required:

- Channel Talk workspace admin access
- Channel Talk Open API Access Key
- Channel Talk Open API Access Secret
- Channel Talk Meet/Phone feature enabled
- At least one test 상담/통화 record that is safe to use in a demo

Security note:

- The previous Channel Talk key was used successfully for a small live backfill.
- Because it was pasted into chat, rotate it before final submission or public demo.
- Store the new key only in ignored local env files or n8n credentials.

Recommended local values:

```text
CHANNEL_TALK_ACCESS_KEY=
CHANNEL_TALK_ACCESS_SECRET=
CHANNEL_TALK_BACKFILL_STATES=closed,opened,snoozed
CHANNEL_TALK_BACKFILL_LIMIT=10
CHANNEL_TALK_BACKFILL_PAGES=1
CHANNEL_TALK_MESSAGE_LIMIT=100
```

### 2. ixi-O Agent Local Secret

Required:

- One random shared secret for n8n -> ixi-O Agent calls.

Example variable:

```text
IXI_O_AGENT_INGEST_SECRET=<random-long-string>
```

Do not put this in prompts, screenshots, GitHub, or docs.

### 3. n8n

Required:

- Use local n8n Docker as the default.
- Import these workflows:
  - `n8n/workflows/channel-talk-sample-ingest.json`
  - `n8n/workflows/channel-talk-webhook-ingest.json`
  - `n8n/workflows/channel-talk-polling-ingest.json`
  - `n8n/workflows/channel-talk-manual-backfill.json`

Recommended execution-data settings:

```text
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=24
```

### 4. Tunnel For Realtime Webhook

Required only for Channel Talk realtime webhook:

- Install and log in to one tunnel tool:
  - ngrok, or
  - cloudflared

Reason:

- Channel Talk cannot call a local `localhost:5678` n8n webhook directly.
- For local n8n Docker, Channel Talk needs a public HTTPS webhook URL that forwards to local n8n.

If no tunnel is ready, the demo can still use manual backfill and polling.

### 5. Local STT

Required for the private local voice demo:

- Decide STT model size:
  - M1 MacBook Air: `base` or `small`
  - Mac mini M4: `small` or `medium`
- Download the whisper.cpp model file.
- Prepare one short, non-sensitive audio file, ideally 1 to 3 minutes.

Current machine has `whisper-cli`, but model files still need to be confirmed.

### 6. EXAONE Local Runtime

Required for LG U+ track:

- Download `EXAONE-4.0-1.2B-GGUF`, preferably `Q4_K_M`.
- Install a local GGUF runner:
  - `llama.cpp` / `llama-cli`, or
  - another confirmed local runtime.

Current machine does not expose `llama-cli` or `ollama` on PATH.

Do not claim EXAONE performs STT. Public EXAONE is the post-processing model over transcripts.

### 7. MISO

Required for default MVP:

- MISO account access.
- MISO guide/sample apps available for reference.

Optional:

- Published MISO app API key if testing `/ext/v1/chat`.

Default submission does not depend on direct MISO push. The MVP creates:

```text
handoff/miso-payload.redacted.json
handoff/proposed-miso-request.json
```

And presents MISO inbound webhook/MCP schema as the proposed integration.

### 8. GitHub And Submission

Required before final submission:

- GitHub repository name.
- Decide public/private visibility.
- Scrub secrets and live customer data before pushing.
- Use synthetic or redacted demo data in the public repo.
- Prepare a short intro page or README:
  - slogan: `일상의 모든 Voice를, 에이전트와 함께`
  - expansion line: `ixi-O 통화와 연동하여 더 강력해져요`
  - core proof: local STT + local EXAONE + review + redacted handoff

Recommended before running a long agent:

- Initialize git if not already initialized.
- Make a baseline commit or local archive before allowing broad edits.

## Decisions The User Should Confirm

### Must decide now

1. Which machine is the main demo runner?
   - Recommended: Mac mini M4.
2. Which tunnel tool should be used for Channel Talk webhook?
   - Recommended: ngrok if the user already has an account; otherwise cloudflared quick tunnel.
3. Which EXAONE runner should be installed?
   - Recommended: llama.cpp / `llama-cli` for GGUF.
4. Which demo data is safe?
   - Recommended: synthetic or explicitly approved test calls only.

### Can decide later

1. Whether to call MISO `/ext/v1/chat` live.
2. Whether to add iPhone Safari/PWA recording before submission.
3. Whether to make GitHub repo public immediately or after redaction.

## Agent Run Guardrails

When using OpenCode:

- Do not pass secrets in the prompt.
- Do not ask it to change global shell config unless explicitly needed.
- Prefer one bounded goal per run.
- After the run, inspect changed files directly.
- Run verification manually:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

If the run touches ingest behavior, also verify:

```bash
IXI_O_AGENT_INGEST_SECRET=dev-secret pnpm test:ingest
```

For live Channel Talk checks, use temporary environment variables or ignored `.env.local`, never checked-in files.
