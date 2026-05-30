# Local n8n Docker

Phone-Claw uses n8n as the automation hub for Channel Talk ingest.

## Current Local Setup

Docker Desktop could pull the n8n image, but container start stalled on this Mac.
For the hackathon demo, the working setup is local Node-based n8n:

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

The local owner account is stored only in `.env.local`:

```text
N8N_OWNER_EMAIL
N8N_OWNER_PASSWORD
```

Imported workflows:

- `Phone-Claw Channel Talk Webhook Ingest Draft`
- `Phone-Claw Channel Talk Polling Backup`
- `Phone-Claw Channel Talk Manual Backfill`
- `Phone-Claw Channel Talk Sample Ingest`

Import command:

```bash
set -a; source .env.local; set +a
N8N_USER_FOLDER="$PWD/n8n-data-v1" \
PHONE_CLAW_INGEST_URL=http://localhost:3000/api/ingest/channel-talk \
PHONE_CLAW_OPENAPI_INGEST_URL=http://localhost:3000/api/ingest/channel-talk/openapi \
PHONE_CLAW_BACKFILL_URL=http://localhost:3000/api/backfill/channel-talk \
fnm exec --using 20.20.2 -- pnpm dlx n8n@1.118.2 import:workflow --separate --input=./n8n/workflows
```

Active workflows:

- realtime webhook
- polling backup

The workflow files are committed with `active: false` for safe import. After
importing, activate the realtime webhook and polling backup workflows in the n8n
editor or with the local REST API.

Realtime webhook URL:

```text
http://localhost:5678/webhook/channel-talk-phone-claw
```

When exposed through Cloudflare Tunnel, use:

```text
https://<trycloudflare-host>/webhook/channel-talk-phone-claw
```

Current quick-tunnel URL for the active demo session:

```text
https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw
```

Quick-tunnel URLs change when the tunnel restarts. See
`docs/channel-talk-webhook.md` for Channel Talk registration steps and the Open
API registration helper.

The workflow JSON includes a stable `webhookId`, so the URL does not depend on
the imported workflow ID.

Manual historical backfill remains available inside n8n as an inactive workflow
that can be run from the editor.

## Start

```bash
docker compose -f docker-compose.n8n.yml --env-file .env.local up -d
```

Open:

```text
http://localhost:5678
```

## Phone-Claw URL From Docker

When n8n runs in Docker, `localhost` points to the n8n container. Use:

```text
http://host.docker.internal:3000/api/ingest/channel-talk
```

## Execution Data

Recommended environment:

```text
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=24
```

## Workflows

Import these first:

```text
n8n/workflows/channel-talk-sample-ingest.json
n8n/workflows/channel-talk-webhook-ingest.json
n8n/workflows/channel-talk-polling-ingest.json
n8n/workflows/channel-talk-manual-backfill.json
```

The Docker compose file mounts local workflow JSON files at `/workflows`, so workflows can be imported with:

```bash
docker compose -f docker-compose.n8n.yml --env-file .env.local run --rm n8n n8n import:workflow --separate --input=/workflows
```

## Real Channel Talk Backfill

There are two ways to pull existing Channel Talk history before the webhook is fully wired.

Run it from n8n:

```text
n8n/workflows/channel-talk-manual-backfill.json
```

Or run it directly from the terminal:

```bash
PHONE_CLAW_INGEST_SECRET=replace-with-local-random-secret \
CHANNEL_TALK_ACCESS_KEY=... \
CHANNEL_TALK_ACCESS_SECRET=... \
pnpm backfill:channel-talk
```

The script reads recent `UserChat` records from Channel Talk Open API v5, fetches each chat's messages, normalizes the text into the local voice-session format, and posts it to:

```text
http://localhost:3000/api/ingest/channel-talk/openapi
```

The Channel Talk Open API credentials must stay in local env vars or n8n credentials.

The n8n manual and polling workflows call the local backfill endpoint:

```text
http://host.docker.internal:3000/api/backfill/channel-talk
```

Useful knobs:

```text
CHANNEL_TALK_BACKFILL_STATES=closed,opened,snoozed
CHANNEL_TALK_BACKFILL_LIMIT=20
CHANNEL_TALK_BACKFILL_PAGES=1
CHANNEL_TALK_MESSAGE_LIMIT=100
```

## Realtime Webhook Shape

`n8n/workflows/channel-talk-webhook-ingest.json` receives a Channel Talk webhook event and posts the raw event to:

```text
http://host.docker.internal:3000/api/ingest/channel-talk/openapi
```

This first version stores the event text immediately. Polling or manual backfill can later consolidate the full `UserChat` message history.

Important n8n detail:

```json
{
  "sendBody": true,
  "bodyContentType": "json",
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify($json.body || $json) }}"
}
```

The n8n Webhook node wraps incoming requests under `$json.body`. Without `specifyBody: "json"`, the HTTP Request node can send an empty-key wrapper such as `{ "": "[object Object]" }` and lose the Channel Talk event.

Observed Channel Talk v5 message event shape:

```json
{
  "event": "push",
  "type": "message",
  "entity": {
    "channelId": "218885",
    "chatType": "userChat",
    "chatId": "USER_CHAT_ID",
    "plainText": "..."
  },
  "refers": {
    "userChat": { "id": "USER_CHAT_ID", "channelId": "218885" }
  }
}
```
