# Phone-Claw Implementation Status

Updated: 2026-05-30

## Current Build

The first working path is implemented:

1. Channel Talk Open API credentials are checked locally.
2. Existing Channel Talk `UserChat` records are fetched by backfill.
3. Each chat's messages are normalized into a local voice-session payload.
4. The payload is written under `private-voice-inbox/sessions`.
5. The local dashboard lists stored voice sessions.
6. A session detail page shows the local transcript, source metadata, EXAONE output, review state, and redacted MISO handoff payload.
7. A local EXAONE button runs GGUF inference when available and falls back to deterministic local processing when the model/CLI fails.
8. MISO-facing APIs hide the redacted payload until human review approves external workflow access.

## Local App

- Dashboard: `http://localhost:3000`
- Sessions API: `GET /api/sessions`
- Session detail API: `GET /api/sessions/{sessionId}`
- EXAONE process API: `POST /api/sessions/{sessionId}/process`
- Review API: `POST /api/sessions/{sessionId}/review`
- Normalized ingest: `POST /api/ingest/channel-talk`
- Raw Channel Talk ingest: `POST /api/ingest/channel-talk/openapi`
- Backfill runner: `POST /api/backfill/channel-talk`

All protected local APIs require:

```text
x-phone-claw-ingest-secret: ${PHONE_CLAW_INGEST_SECRET}
```

## n8n Workflows

Import these into local n8n:

- `n8n/workflows/channel-talk-sample-ingest.json`
- `n8n/workflows/channel-talk-webhook-ingest.json`
- `n8n/workflows/channel-talk-polling-ingest.json`
- `n8n/workflows/channel-talk-manual-backfill.json`

The polling and manual backfill workflows call the local backfill endpoint. Channel Talk API pagination and local storage are handled by the app.

## Verified

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm check:channel-talk`
- `pnpm backfill:channel-talk` with a small live scope
- `GET /api/sessions`
- `POST /api/sessions/{sessionId}/process`
- `POST /api/sessions/{sessionId}/review`
- MISO detail API blocks payload before review and returns `rawTranscriptIncluded: false` payload after review
- Current Cloudflare tunnel -> n8n webhook returned HTTP `200`

The live backfill stored Channel Talk sessions locally. Credentials were not written to source files.

## Channel Talk Realtime Webhook

Current quick tunnel:

```text
https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw
```

Channel Talk webhook list API returned `0` webhooks. The documented create API returned Channel Talk HTTP `500` with the required `scopes` field, so the demo path is manual UI registration:

```text
Settings > Webhook > Create new webhook
```

See `docs/channel-talk-webhook.md`.

## Next

The persistent task queue is now tracked in `current/agent-task-queue.md`.

Recommended next work unit:

1. `T1. Channel Talk Realtime Proof` - register the n8n webhook URL in Channel Talk UI, run one live event through the webhook, and confirm it lands in `private-voice-inbox`.
2. If realtime registration is blocked, move to `T2. Demo Flow Hardening` so the sample/backfill -> EXAONE -> review -> MISO proposal path is presentation-safe.
