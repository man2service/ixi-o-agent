# Local n8n Docker

Phone-Claw uses n8n as the automation hub for Channel Talk ingest.

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
