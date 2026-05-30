# Telegram Kiya Integration Research

This document captures what we currently know before building a toy Telegram
agent integration.

## Product Role

`Kiya` is the Telegram-facing agent layer for Phone-Claw. The current Kiya bot
is already bound to the Hermes agent, so Phone-Claw should not try to create a
separate Telegram input agent for this path.

The final product flow should look like:

```text
Voice session saved
  -> EXAONE/local processing
  -> human review or draft handoff created
  -> Phone-Claw calls Hermes with the safe summary/action payload
  -> Hermes/Kiya sends a Telegram notification
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

Build the smallest useful loop first. This is outbound only; Telegram voice
messages are not an input source in this step.

1. Store the Kiya/Hermes integration secrets in `.env.local`.
2. After EXAONE processing, automatically prepare the safe session payload.
3. Call the Hermes webhook when `HERMES_AGENT_WEBHOOK_URL` is set.
4. Send the resulting message through Kiya Telegram delivery when
   `TELEGRAM_BOT_TOKEN` and `TELEGRAM_KIYA_CHAT_ID` are set.
5. If secrets are absent, keep the same flow as a dry-run.

Current implemented endpoint:

```text
POST /api/sessions/{sessionId}/notify-kiya
```

Environment:

```text
PHONE_CLAW_KIYA_AUTO_NOTIFY=true
HERMES_AGENT_WEBHOOK_URL=
HERMES_AGENT_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_KIYA_CHAT_ID=
```

`PHONE_CLAW_KIYA_AUTO_NOTIFY` is on by default. Set it to `false` to disable
automatic delivery after EXAONE processing.

Later, add inbound text commands:

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

Voice-message intake should only be added after the outbound Kiya/Hermes loop is
stable.

## Two Integration Options

### Option A: Hermes-first with Telegram delivery

Call Hermes with the redacted Phone-Claw payload, then deliver the Hermes
message through the Kiya bot token.

Pros:

- Matches the current Kiya/Hermes binding.
- Keeps recommendation logic in Hermes when the webhook exists.
- Phone-Claw still has a dry-run/local planner fallback.

Cons:

- Requires the actual Hermes ingress URL and, if needed, API key.
- A direct Telegram `sendMessage` from the bot sends a message as Kiya but does
  not by itself make another Telegram bot process a user message.

### Option B: Direct Telegram Bot API Only

Use Telegram Bot API without Hermes.

Pros:

- Useful for delivery smoke tests.
- Works when Hermes ingress is not available.

Cons:

- Does not satisfy the full agent recommendation goal by itself.
- Telegram bots generally cannot message other bots to trigger them.

## Recommended Sequence

Start with Option A:

```text
Phone-Claw -> Hermes recommendation -> Kiya Telegram notification
```

Then add Kiya reply handling once we know the Hermes/OpenClaw callback contract.

## Data Boundary

- Do not send raw transcript or raw audio to Telegram by default.
- Telegram notification uses the reviewed/redacted handoff payload or EXAONE
  summary/action items.
- Voice messages sent to the bot are stored locally, then passed through local
  STT, just like Private Mode.
- Restrict the toy to `TELEGRAM_ALLOWED_CHAT_ID` so random users cannot control
  the local inbox.

## Open Questions For The User

To integrate with the actual Kiya agent, we still need:

1. What is the Hermes ingress URL or tool contract that Kiya is bound to?
2. Does Hermes itself deliver to Kiya, or should Phone-Claw send Telegram
   `sendMessage` using the Kiya bot token after Hermes returns recommendations?
3. Can Kiya call local HTTP endpoints, or does Phone-Claw need to push messages
   into Kiya?
4. Should Telegram replies modify Phone-Claw session JSON directly, or only add
   review notes until a human approves?
5. Should Kiya ever receive raw transcript text, or only redacted summaries and
   action items?
