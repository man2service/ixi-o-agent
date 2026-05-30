# Demo Operations Runbook

This runbook prepares the live demo path without depending on real customer
content. Use synthetic or explicitly approved data for public demos.

## Goal

Show the full Phone-Claw loop:

```text
Channel Talk or Private Mode
  -> local Phone-Claw inbox
  -> EXAONE/local processing
  -> human review
  -> redacted MISO-facing handoff
```

## Current Safety Position

- n8n and Cloudflare Tunnel should stay stopped until a deliberate demo run.
- Do not send Channel Talk test messages to real customer chats.
- Use the synthetic proof session when possible:

```text
20260530T153141_utc_channel_talk_e7b435ae0b
```

## Preflight

```bash
git status --short
pnpm typecheck
pnpm build
pnpm smoke:local
pnpm check:stt
```

Expected:

- `git status --short` has no uncommitted source changes.
- `pnpm smoke:local` reports `miso_blocked_before_review`,
  `miso_available_after_review`, `local_voice_frontdoor_ingested`, and Kiya
  dry-run checks.
- `pnpm check:stt` returns a non-empty transcript preview.

## Kiya/Hermes Settings

Kiya outbound delivery is automatic after EXAONE processing unless disabled:

```text
PHONE_CLAW_KIYA_AUTO_NOTIFY=true
```

To disable automatic delivery:

```text
PHONE_CLAW_KIYA_AUTO_NOTIFY=false
```

Optional live settings:

```text
HERMES_AGENT_WEBHOOK_URL=
HERMES_AGENT_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_KIYA_CHAT_ID=
```

If `HERMES_AGENT_WEBHOOK_URL` is empty, Phone-Claw uses a local planner to detect
only calendar-worthy follow-ups. Kiya receives the summary message first. A
second calendar-confirmation prompt is sent only when the session looks
schedulable. If Telegram credentials are empty, the route returns a dry-run
result instead of sending messages. Every notification attempt is also written
to the session folder at:

```text
agent/kiya-notification.latest.json
agent/kiya-notification.log.jsonl
```

The session detail page shows the latest Kiya/Hermes message preview, so the
demo can prove the outbound payload even before live Telegram credentials are
configured.

If Kiya/Hermes later performs the calendar action, it can record the result
without Phone-Claw owning calendar execution:

```text
POST /api/sessions/{sessionId}/kiya-calendar-result
```

The callback writes `agent/kiya-calendar-result.latest.json` and appears in the
same Kiya/Hermes panel on the session detail page.

## Start The Local App

```bash
set -a; source .env.local; set +a
pnpm dev
```

Open:

```text
http://localhost:3000
```

Do not run `pnpm build` while the dev server is running.

## Start n8n

Use the local Node-based n8n setup:

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

Open:

```text
http://localhost:5678
```

Confirm these workflows are imported:

- `Phone-Claw Channel Talk Webhook Ingest Draft`
- `Phone-Claw Channel Talk Polling Backup`
- `Phone-Claw Channel Talk Manual Backfill`
- `Phone-Claw Channel Talk Sample Ingest`

## Start Cloudflare Tunnel

Only do this when you intentionally want external webhook traffic:

```bash
cloudflared tunnel --url http://localhost:5678
```

Copy the generated `https://*.trycloudflare.com` URL and append:

```text
/webhook/channel-talk-phone-claw
```

## Channel Talk Webhook

Channel Talk webhook creation through Open API returned server-side `500`.
Use the Channel Talk UI for live demo runs:

1. Open Channel Talk settings.
2. Go to webhook settings.
3. Update or create `Phone-Claw n8n realtime`.
4. Set scopes to:

```text
userChat.opened
message.created.userChat
```

5. Set URL to the current Cloudflare Tunnel webhook URL.

Verify the registered webhook with:

```bash
set -a; source .env.local; set +a
pnpm webhook:channel-talk list
```

## Demo Paths

### Safe Primary Path

1. Open `http://localhost:3000`.
2. Open the synthetic proof session:

```text
20260530T153141_utc_channel_talk_e7b435ae0b
```

3. Show local transcript, EXAONE output, review approval, and MISO handoff.

### Private Mode Backup

1. Paste a short Korean meeting transcript into `Private Mode`, or press the
   browser recording buttons and upload the captured audio.
2. Create a `meeting` session. For a reliable live demo, include a pasted
   transcript unless `pnpm check:stt` has already confirmed local Whisper.
3. Open the created session.
4. Run EXAONE processing.
5. Confirm the Kiya/Hermes notice says sent or dry-run and that the latest
   Kiya/Hermes panel shows the generated messages.
6. If the transcript includes a follow-up meeting or appointment, confirm that
   Kiya receives a second calendar prompt after the summary.
7. Approve MISO handoff.

### n8n Backup

If live Channel Talk webhook delivery is unreliable:

1. Run `Phone-Claw Channel Talk Sample Ingest`.
2. Or run `Phone-Claw Channel Talk Manual Backfill`.
3. Show the resulting local session in Phone-Claw.

## Shutdown

Stop in this order:

1. Cloudflare Tunnel
2. n8n
3. Next dev server

After shutdown, confirm no live external bridge is running:

```bash
ps aux | rg 'next dev -p 3000|n8n|cloudflared' || true
```

## Final Demo Notes

- Never approve real customer transcript sessions for public demo unless the
  user explicitly confirms the content is safe.
- Keep `.env.local`, `private-voice-inbox/`, `n8n-data*/`, and `models/` out of
  git.
- If Cloudflare Tunnel restarts, update the Channel Talk webhook URL again.
