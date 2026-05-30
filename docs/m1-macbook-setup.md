# M1 MacBook Setup

Updated: 2026-05-30 KST

This guide is for pulling the GitHub repo on another Apple Silicon Mac and running Phone-Claw without committing any local credentials, transcripts, n8n runtime data, or model files.

## What Works Without Secrets

You can run the web app, sample ingest, local storage, session review UI, and EXAONE fallback mode with no external API keys.

Channel Talk realtime/backfill requires local-only Channel Talk credentials. n8n requires local-only owner credentials and encryption key. EXAONE real inference requires downloading the local GGUF model.

## 1. Clone Or Pull

```bash
git clone https://github.com/man2service/Phoneclaw.git
cd Phoneclaw
```

If the repo already exists:

```bash
cd /path/to/Phoneclaw
git pull origin main
```

## 2. Install Local Runtime

```bash
brew install fnm
fnm install 20.20.2
fnm use 20.20.2
corepack enable
pnpm install
```

Check:

```bash
node -v
pnpm -v
```

The repo is pinned to `pnpm@9.15.0` in `package.json`.

## 3. Create Local Env

Copy the template, then edit only your local `.env.local`.

```bash
cp .env.example .env.local
```

Generate local random values:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Put those generated values into:

```text
PHONE_CLAW_INGEST_SECRET=<first-random-value>
N8N_ENCRYPTION_KEY=<second-random-value>
```

Use local-only n8n owner values:

```text
N8N_OWNER_EMAIL=phoneclaw.local@example.com
N8N_OWNER_PASSWORD=<local-password>
```

Do not commit `.env.local`. It is ignored by git.

## 4. Run The App

```bash
set -a; source .env.local; set +a
pnpm dev
```

Open:

```text
http://localhost:3000
```

In another terminal, seed a local sample session:

```bash
set -a; source .env.local; set +a
pnpm test:ingest
```

Then refresh the inbox and open the session detail page.

## 5. Optional: Channel Talk Credentials

Only add these on the machine that should talk to Channel Talk:

```text
CHANNEL_TALK_ACCESS_KEY=<local-only>
CHANNEL_TALK_ACCESS_SECRET=<local-only>
CHANNEL_TALK_BACKFILL_STATES=closed,opened,snoozed
CHANNEL_TALK_BACKFILL_LIMIT=3
CHANNEL_TALK_BACKFILL_PAGES=1
```

Check credentials without printing secrets:

```bash
set -a; source .env.local; set +a
pnpm check:channel-talk
```

Pull recent history:

```bash
set -a; source .env.local; set +a
pnpm backfill:channel-talk
```

## 6. Optional: n8n On M1

The easiest reproducible path is Node-based n8n, not Docker:

```bash
set -a; source .env.local; set +a
N8N_USER_FOLDER="$PWD/n8n-data-v1" \
N8N_HOST=localhost \
N8N_PORT=5678 \
N8N_PROTOCOL=http \
N8N_SECURE_COOKIE=false \
N8N_DIAGNOSTICS_ENABLED=false \
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false \
DB_SQLITE_POOL_SIZE=2 \
N8N_RUNNERS_ENABLED=true \
N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
N8N_GIT_NODE_DISABLE_BARE_REPOS=true \
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none \
EXECUTIONS_DATA_SAVE_ON_ERROR=all \
EXECUTIONS_DATA_PRUNE=true \
EXECUTIONS_DATA_MAX_AGE=24 \
PHONE_CLAW_INGEST_URL=http://localhost:3000/api/ingest/channel-talk \
PHONE_CLAW_OPENAPI_INGEST_URL=http://localhost:3000/api/ingest/channel-talk/openapi \
PHONE_CLAW_BACKFILL_URL=http://localhost:3000/api/backfill/channel-talk \
fnm exec --using 20.20.2 -- pnpm dlx n8n@1.118.2
```

Import workflows:

```bash
set -a; source .env.local; set +a
N8N_USER_FOLDER="$PWD/n8n-data-v1" \
PHONE_CLAW_INGEST_URL=http://localhost:3000/api/ingest/channel-talk \
PHONE_CLAW_OPENAPI_INGEST_URL=http://localhost:3000/api/ingest/channel-talk/openapi \
PHONE_CLAW_BACKFILL_URL=http://localhost:3000/api/backfill/channel-talk \
fnm exec --using 20.20.2 -- pnpm dlx n8n@1.118.2 import:workflow --separate --input=./n8n/workflows
```

Runtime data stays in `n8n-data-v1/`, which is ignored by git.

## 7. Optional: Local Models

The app can run without local models. If `llama-cli` or the EXAONE GGUF file is missing, the session process button returns a `fallback-local` result so the demo flow still works.

For the full local model path:

```bash
brew install whisper-cpp llama.cpp
mkdir -p models/whisper models/exaone
curl -L \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin \
  -o models/whisper/ggml-small.bin
```

Install Hugging Face CLI if needed:

```bash
python3 -m pip install --user -U "huggingface_hub[cli]"
```

Download EXAONE GGUF:

```bash
huggingface-cli download LGAI-EXAONE/EXAONE-4.0-1.2B-GGUF \
  --include "EXAONE-4.0-1.2B-Q4_K_M.gguf" \
  --local-dir models/exaone
```

Expected local files:

```text
models/whisper/ggml-small.bin
models/exaone/EXAONE-4.0-1.2B-Q4_K_M.gguf
```

These model files are ignored by git.

## 8. M1 Performance Notes

- Basic app, sample ingest, Channel Talk backfill, and review UI should be fine on an M1 MacBook.
- EXAONE 4.0 1.2B Q4 is the intended small local model path. It is much more realistic on M1 than 32B/33B models.
- Whisper `small` is usable but can be slow on the base M1. For fast tests, use existing Channel Talk transcript input or switch to a smaller Whisper model manually.
- Keep the model files local. Do not copy raw transcripts or `.env.local` through git.

## 9. Files That Must Stay Local

These are intentionally ignored:

```text
.env.local
private-voice-inbox/
n8n-data/
n8n-data-v1/
models/
config/local.json
```

If `git status --short` shows any of these paths, stop and check `.gitignore` before committing.

## Sources

- EXAONE 4.0 1.2B GGUF model and llama.cpp usage: https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B-GGUF
- Whisper.cpp GGML model files: https://huggingface.co/ggerganov/whisper.cpp
