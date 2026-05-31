# User Action Checklist

Updated: 2026-05-31 KST

This file tracks only actions that require the user's account, local secret
entry, or live service approval. Do not put secrets in this file.

## Required For Final Live Rehearsal

1. Confirm which demo path to lead with:
   - Recommended: public showcase -> local synthetic proof session -> MISO custom-tool or fallback JSON.
   - Live Channel Talk should be a bonus path only, because quick tunnel/webhook delivery can be unstable.

2. Enter local secrets only in `.env.local` or service credential screens:
   - `IXI_O_AGENT_INGEST_SECRET`
   - `IXI_O_AGENT_MISO_GATEWAY_TOKEN`
   - Channel Talk access key/secret/channel id if running live backfill or webhook checks
   - Telegram bot token and Kiya chat id if running live Telegram delivery
   - Hermes webhook URL/API key if Kiya should call the bound Hermes agent

3. If showing MISO live:
   - Start `pnpm miso:gateway`.
   - Start a Cloudflare tunnel to port `3321`.
   - Generate current OpenAPI with `pnpm miso:openapi:v3 https://<trycloudflare-host>`.
   - Paste `miso/generated/ixi-o-agent-openapi.current-tunnel.v3.json` into MISO custom tool.
   - Use the short-lived `IXI_O_AGENT_MISO_GATEWAY_TOKEN` as the MISO bearer token.
   - Save and publish the MISO app before judging.
   - Record non-secret evidence in `docs/miso-submit-evidence.md`.

4. If showing live Channel Talk:
   - Start local app, n8n, then Cloudflare tunnel to n8n.
   - Update the Channel Talk webhook URL through the Channel Talk UI.
   - Use test/synthetic chats only unless the content is explicitly safe for the public demo.

5. If showing real local STT:
   - Confirm `whisper-cli` and `models/whisper/ggml-small.bin` are present on the Mac mini M4.
   - Run `pnpm check:stt`.
   - Use a short non-sensitive Korean sample for the live proof.

6. Before making the GitHub repo public or sharing it beyond judges:
   - Confirm that sponsor/operator contact details in archived source material
     are redacted or intentionally allowed for the submission audience.

## Do Not Do

- Do not paste `.env.local` contents into MISO, GitHub, Vercel, screenshots, or the public showcase.
- Do not tunnel the full Next app to MISO for judging. Tunnel only the MISO gateway.
- Do not approve real customer sessions for public MISO handoff unless the content is confirmed safe.
- Do not present direct MISO inbound voice ingest as implemented. Present it as the concrete platform proposal.

## Fast Fallback If Live Services Fail

Use these artifacts:

- Public overview: `https://ixi-o-agent.vercel.app`
- Local synthetic proof session: `20260530T153141_utc_channel_talk_e7b435ae0b`
- MISO fallback approved payload: `miso/samples/approved-voice-session-handoff.sample.json`
- MISO blocked-before-review payload: `miso/samples/blocked-voice-session-detail.sample.json`
- Submission narrative: `docs/submission-pack.md`
- MISO judging runbook: `docs/miso-track-submission-runbook.md`
