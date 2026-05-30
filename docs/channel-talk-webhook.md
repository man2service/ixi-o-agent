# Channel Talk Realtime Webhook

Updated: 2026-05-30 KST

## Goal

Channel Talk should push realtime user-chat events into local n8n, then n8n normalizes or backfills the full chat history into Phone-Claw.

```text
Channel Talk Webhook
  -> Cloudflare Tunnel
  -> local n8n Webhook Trigger
  -> Phone-Claw ingest/openapi endpoint
  -> private-voice-inbox/sessions
  -> EXAONE local processing
  -> human review
  -> MISO redacted handoff proposal
```

## Current Demo URL

The current quick tunnel is:

```text
https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw
```

This URL is ephemeral. If `cloudflared tunnel --url http://localhost:5678` is restarted, replace it with the new `trycloudflare.com` URL.

The endpoint was checked on 2026-05-30 KST and returned HTTP `200` through the tunnel.

## Manual Registration

Official Channel Talk docs say webhook configuration is under:

```text
Settings > Webhook > Create new webhook
```

Use:

```text
Name: Phone-Claw n8n realtime
URL:  https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw
Event: User chat / event notification
```

Keep the polling backup active even after realtime webhook registration. Channel Talk webhook events can arrive before the final call transcript or full message history is ready, so polling/manual backfill is still the repair path.

## Open API Registration Attempt

Channel Talk also documents:

```text
POST https://api.channel.io/open/v5/webhooks
```

The local helper is:

```bash
set -a; source .env.local; set +a
CHANNEL_TALK_WEBHOOK_URL=https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw \
pnpm webhook:channel-talk upsert
```

Current observed result:

- `GET /open/v5/webhooks` succeeded and returned `0` existing webhooks.
- `POST /open/v5/webhooks` with the documented `scopes: ["userChatOpened"]` shape returned Channel Talk HTTP `500`.
- `POST /open/v5/webhooks` without `scopes` returned HTTP `422`, so the scope field is required by the current API.

Because creation failed server-side, use the manual UI registration for the demo and keep the script for retrying once Channel Talk support/API behavior stabilizes.

## Sources

- Channel Talk Webhook setup: https://developers.channel.io/docs/getting-started-2
- Channel Talk Webhook events: https://developers.channel.io/docs/webhook-events
- Channel Talk Open API create webhook: https://developers.channel.io/en/articles/Create-a-Webhook-86a0c328
