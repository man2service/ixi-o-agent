# Phone-Claw Implementation Status

Updated: 2026-05-30

## Current Build

The first working path is implemented:

1. Channel Talk Open API credentials are checked locally.
2. Existing Channel Talk `UserChat` records are fetched by backfill.
3. Each chat's messages are normalized into a local voice-session payload.
4. The payload is written under `private-voice-inbox/sessions`.
5. The local dashboard lists stored voice sessions.

## Local App

- Dashboard: `http://localhost:3000`
- Sessions API: `GET /api/sessions`
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

The live backfill stored 2 Channel Talk sessions locally. Credentials were not written to source files.

## Next

1. Move credentials into ignored local environment files or n8n credentials.
2. Import n8n workflows and run `Phone-Claw Channel Talk Manual Backfill`.
3. Register the n8n webhook URL in Channel Talk for realtime events.
4. Add the EXAONE/STT processing step that consumes `agent/voice-session-draft.json`.
