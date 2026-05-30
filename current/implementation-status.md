# Phone-Claw Implementation Status

Updated: 2026-05-31

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
9. Channel Talk realtime webhook is registered through the UI and proven with a synthetic live event.
10. The dashboard and session detail pages now show the demo golden path and review gate status directly.
11. A credential-free local black-box smoke test verifies sample ingest, fallback-local processing, review gating, and redacted MISO payload availability.

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
- Synthetic Channel Talk message event -> Cloudflare Tunnel -> n8n -> `POST /api/ingest/channel-talk/openapi` -> local session `20260530T153141_utc_channel_talk_e7b435ae0b`
- Synthetic proof session `20260530T153141_utc_channel_talk_e7b435ae0b` processed with local EXAONE model path available, then approved for redacted MISO payload access
- `pnpm smoke:local` with temp storage and no external credentials

The live backfill stored Channel Talk sessions locally. Credentials were not written to source files.

## Channel Talk Realtime Webhook

Current quick tunnel:

```text
https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw
```

Channel Talk webhook list API now returns one active webhook:

```text
Name: Phone-Claw n8n realtime
Channel: 218885
Scopes: userChat.opened, message.created.userChat
URL: https://survivors-medieval-stephanie-industry.trycloudflare.com/webhook/channel-talk-phone-claw
Blocked: false
```

The documented create API still returned Channel Talk HTTP `500` with the required `scopes` field, so webhook creation remains a manual UI step. The API list command is still useful for verification.

The first real proof exposed an actual v5 webhook shape difference: Channel Talk sends `type: "message"` and `entity` at the top level. The parser now accepts this shape, as well as n8n's wrapped `body` shape.

See `docs/channel-talk-webhook.md`.

## Next

The persistent task queue is now tracked in `current/agent-task-queue.md`.

Recommended next work unit:

1. `T4. Local Voice Capture Frontdoor` - add a non-Channel Talk local voice input path if time remains.
2. `T6. Submission Pack` - polish the README/demo intro for judging and final GitHub submission.

## Runtime Note

Do not run `pnpm build` while `pnpm dev` is serving the same app. Both use `.next`; build can leave the dev server holding stale chunk references. Stop dev, run build, then restart dev.
