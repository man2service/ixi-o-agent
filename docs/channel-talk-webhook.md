# Channel Talk Realtime Webhook

Updated: 2026-05-31 KST

## Goal

Channel Talk should push realtime user-chat events into local n8n, then n8n normalizes or backfills the full chat history into ixi-O Agent.

```text
Channel Talk Webhook
  -> Cloudflare Tunnel
  -> local n8n Webhook Trigger
  -> ixi-O Agent ingest/openapi endpoint
  -> IXI_O_AGENT_STORAGE_DIR/sessions
  -> EXAONE local processing
  -> human review
  -> MISO redacted handoff proposal
```

## Current Demo URL

The current quick tunnel is:

```text
https://chamber-institutes-improvement-birth.trycloudflare.com/webhook/channel-talk-ixi-o-agent
```

This URL is ephemeral. If `cloudflared tunnel --url http://localhost:5678` is restarted, replace it with the new `trycloudflare.com` URL.

The endpoint was checked on 2026-05-31 KST:

- `POST {"event":"healthcheck","source":"ixi-o-agent-tunnel-check"}` -> tunnel -> n8n returned HTTP `200`.
- Local n8n webhook route `http://localhost:5678/webhook/channel-talk-ixi-o-agent` also returned HTTP `200`.

## Manual Registration

Official Channel Talk docs say webhook configuration is under:

```text
Settings > Webhook > Create new webhook
```

Use:

```text
Name: ixi-O Agent n8n realtime
URL:  https://chamber-institutes-improvement-birth.trycloudflare.com/webhook/channel-talk-ixi-o-agent
Event: User chat / event notification
```

Keep the polling backup active even after realtime webhook registration. Channel Talk webhook events can arrive before the final call transcript or full message history is ready, so polling/manual backfill is still the repair path.

2026-05-31 registration state:

- A persistent webhook was created from the Channel Talk UI.
- Channel ID: `218885`
- Webhook name: `ixi-O Agent n8n realtime`
- URL: `https://chamber-institutes-improvement-birth.trycloudflare.com/webhook/channel-talk-ixi-o-agent`
- Scopes: `userChat.opened`, `message.created.userChat`
- `GET /open/v5/webhooks` verifies it is present and not blocked.
- The webhook secret/token is intentionally not committed or documented.

After creation, trigger one user chat event and verify:

```bash
set -a; source .env.local; set +a
curl -fsS http://localhost:3000/api/sessions
```

If the webhook event does not contain the full transcript, run the manual backfill workflow or:

```bash
curl -fsS -X POST \
  -H "content-type: application/json" \
  -H "x-ixi-o-agent-ingest-secret: $IXI_O_AGENT_INGEST_SECRET" \
  http://localhost:3000/api/backfill/channel-talk \
  -d '{"states":["closed","opened","snoozed"],"chatLimit":3,"chatPages":1,"messageLimit":100}'
```

The app process must be started with `CHANNEL_TALK_ACCESS_KEY` and `CHANNEL_TALK_ACCESS_SECRET` in its local environment for live backfill. Do not commit these values.

## Realtime Proof

2026-05-31 KST proof:

- Created a synthetic Channel Talk member and `UserChat` via Open API.
- Sent a synthetic bot message to that test chat.
- Channel Talk delivered the event to the Cloudflare tunnel.
- n8n forwarded it to `POST /api/ingest/channel-talk/openapi`.
- ixi-O Agent stored a local session with one transcript utterance.

Proof session:

```text
Session ID: 20260530T153141_utc_channel_talk_e7b435ae0b
UserChat ID: 6a1b02ddd976f0c7e692
Status: pending_processing
Utterances: 1
Preview: ixi-O Agent realtime parser-fixed proof 20260530153320: n8n 실시간 웹훅 경로가 전사문을 저장하는지 검증합니다.
```

Observed actual Channel Talk v5 webhook body shape:

```json
{
  "event": "push",
  "type": "message",
  "entity": {
    "channelId": "218885",
    "chatType": "userChat",
    "chatId": "USER_CHAT_ID",
    "personType": "bot",
    "personId": "BOT_ID",
    "blocks": [{ "type": "text", "value": "..." }],
    "plainText": "..."
  },
  "refers": {
    "userChat": { "id": "USER_CHAT_ID", "channelId": "218885" }
  }
}
```

The parser must treat the top-level `{ type, entity }` object as the webhook event. Do not only look for `webhookEvent.type`.

## n8n Body Handling Finding

The first realtime proof failed before Channel Talk registration because n8n's Webhook node wraps inbound requests as:

```json
{
  "headers": {},
  "params": {},
  "query": {},
  "body": {},
  "webhookUrl": "...",
  "executionMode": "production"
}
```

The ixi-O Agent OpenAPI ingest now unwraps that `body`, accepts JSON string bodies, and defends against n8n's empty-key wrapper shape. The n8n HTTP Request nodes must also set:

```json
{
  "sendBody": true,
  "bodyContentType": "json",
  "specifyBody": "json"
}
```

Without `specifyBody: "json"`, n8n can send a key/value-style body like `{ "": "[object Object]" }`, which loses the event payload.

## Open API Registration Attempt

Channel Talk also documents:

```text
POST https://api.channel.io/open/v5/webhooks
```

The local helper is:

```bash
set -a; source .env.local; set +a
CHANNEL_TALK_WEBHOOK_URL=https://chamber-institutes-improvement-birth.trycloudflare.com/webhook/channel-talk-ixi-o-agent \
pnpm webhook:channel-talk upsert
```

Current observed result:

- `GET /open/v5/webhooks` succeeds and returns the active `ixi-O Agent n8n realtime` webhook.
- `PATCH /open/v5/webhooks/{id}` succeeds and updates the current quick tunnel URL.
- `POST /open/v5/webhooks` with the documented `scopes: ["userChatOpened"]` shape returned Channel Talk HTTP `500`.
- v5 variants with `apiVersion`, `blocked`, and `keywords` also returned HTTP `500`.
- v4 variants without `scopes` returned HTTP `422`, confirming that `scopes` is required.
- v4 variants with `scopes` returned HTTP `500`.
- `POST /open/v5/webhooks` without `scopes` returned HTTP `422`, so the scope field is required by the current API.

Because creation failed server-side after endpoint health was proven, use the
manual UI registration for first-time creation. Once the webhook exists,
`pnpm webhook:channel-talk upsert` can update its URL.

## Sources

- Channel Talk Webhook setup: https://developers.channel.io/docs/getting-started-2
- Channel Talk Webhook events: https://developers.channel.io/docs/webhook-events
- Channel Talk Open API create webhook: https://developers.channel.io/en/articles/Create-a-Webhook-86a0c328
