# Telegram Kiya Integration Research

This document captures what we currently know before building a toy Telegram
agent integration.

## Product Role

`Kiya` is the Telegram-facing agent layer for Phone-Claw.

The final product flow should look like:

```text
Voice session saved
  -> EXAONE/local processing
  -> human review or draft handoff created
  -> Kiya sends a Telegram notification
  -> user replies with a natural-language correction or command
  -> Phone-Claw updates local session memory/action state
```

In older local planning docs, this role appears as `OpenClaw 텔레그램
에이전트` or `call-memory-agent`.

## What Existing Local Plans Already Say

From `current/ixi-o-mvp-implementation-plan.md` and
`current/ixi-o-mvp-agent-handoff-prompt.md`:

- Telegram should notify the user after a call/session memory is saved.
- Short sessions can send fuller content; long sessions should send summary and
  action items only.
- User replies can request edits, for example:
  - "김민수를 김민호로 바꿔줘"
  - "두 번째 액션 아이템 날짜를 6월 5일로 수정해"
  - "세 번째 액션 완료 처리해줘"
- The agent should update the local Markdown/session memory and indexes.
- A demo bot can be created through BotFather.
- Prior plan assumed OpenClaw + ChatGPT backend, but Phone-Claw can also start
  with a direct Telegram Bot API toy.

## Telegram Bot API Facts To Rely On

Official Bot API docs say:

- A bot receives updates either by `getUpdates` long polling or by webhook.
- `getUpdates` and webhook are mutually exclusive.
- Webhooks require an HTTPS URL.
- `setWebhook` can include `secret_token`; Telegram then sends it in the
  `X-Telegram-Bot-Api-Secret-Token` header.
- Voice messages arrive as ordinary message updates with a `voice` object.
- To download a voice file, call `getFile(file_id)`, then download from
  `https://api.telegram.org/file/bot<token>/<file_path>`.
- Bot file downloads are limited to 20 MB.

References:

- https://core.telegram.org/bots/api#getupdates
- https://core.telegram.org/bots/api#setwebhook
- https://core.telegram.org/bots/api#getfile
- https://core.telegram.org/bots/api#voice

## Recommended Toy Scope

Build the smallest useful loop first:

1. Create a demo Telegram bot through BotFather.
2. Store `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
   `TELEGRAM_ALLOWED_CHAT_ID` in `.env.local`.
3. Add one local webhook endpoint:

```text
POST /api/telegram/kiya/webhook
```

4. Add one local send endpoint or script:

```text
POST /api/telegram/kiya/notify-session
```

5. Start with text commands only:

```text
/start
/sessions
/session <sessionId>
/approve <sessionId>
/todo <sessionId>
```

6. Then add reply-based natural language edits:

```text
"이 세션에서 두 번째 할 일 완료 처리해줘"
"요약에서 고객명을 익명 처리해줘"
```

7. Add voice-message intake only after the text loop works.

## Two Integration Options

### Option A: Direct Telegram Bot API

Use simple HTTP calls from the existing Next app.

Pros:

- Smallest toy.
- No new runtime.
- Easy to verify with curl and Cloudflare Tunnel.

Cons:

- We implement command parsing, dedupe, and state ourselves.
- Less reusable if we later add Slack/Discord.

### Option B: OpenClaw/Kiya Agent Runtime

Use the existing Kiya/OpenClaw agent layer if it is already running and can
expose Telegram + tool calls.

Pros:

- Closer to the user's final agent workflow.
- Better for natural-language edits once the runtime is known.

Cons:

- We need the actual Kiya/OpenClaw repo, config format, credentials, and local
  runtime behavior.
- Riskier for the first toy unless that environment is already stable.

## Recommended Sequence

Start with Option A as the proof toy:

```text
Phone-Claw -> Telegram notification -> user text reply -> local session update
```

Then adapt the same command contract into Kiya/OpenClaw once we know its runtime
shape.

## Data Boundary

- Do not send raw transcript or raw audio to Telegram by default.
- Telegram notification should use the reviewed/redacted handoff payload or a
  short local-only summary.
- Voice messages sent to the bot are stored locally, then passed through local
  STT, just like Private Mode.
- Restrict the toy to `TELEGRAM_ALLOWED_CHAT_ID` so random users cannot control
  the local inbox.

## Open Questions For The User

To integrate with the actual Kiya agent, we still need:

1. Is Kiya already a Telegram bot, or should we create a new demo bot?
2. Is Kiya backed by OpenClaw, a custom server, n8n, or another agent runtime?
3. Can Kiya call local HTTP endpoints, or does Phone-Claw need to push messages
   into Kiya?
4. Should Telegram replies modify Phone-Claw session JSON directly, or only add
   review notes until a human approves?
5. Should Kiya ever receive raw transcript text, or only redacted summaries and
   action items?
