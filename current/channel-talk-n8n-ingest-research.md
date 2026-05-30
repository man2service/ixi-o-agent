# Channel Talk + n8n Ingest Research

> 작성일: 2026-05-30 KST
> 목적: 채널톡 전화/Meet 기능의 전사문 또는 녹음 파일을 n8n으로 가져와 Phone-Claw 데모 앱 입력으로 사용할 수 있는지 정리
> 기준 문서: `contest-source-pack/research/CHANNEL_TALK_N8N_INGEST.md`

## 결론

채널톡의 전화/Meet 기능은 Phone-Claw / Voice-to-AgentOps 데모의 입력 소스로 쓸 수 있다.

권장 흐름:

```text
Channel Talk phone/meet
  -> call record + transcript/STT chat in Channel Talk
  -> n8n Channel Talk node or HTTP Request
  -> Phone-Claw /api/ingest/channel-talk
  -> session 저장 / pending_processing
  -> later EXAONE post-processing
  -> later agent-input.json / MISO payload
```

사용자 경험은 webhook-first가 맞다. 다만 직접적인 "call transcript webhook" 이벤트 하나에만 의존하지 않는 편이 안전하다. 더 안정적인 설계는 다음 순서다.

1. Channel Talk webhook을 n8n Webhook Trigger로 받는다.
2. `userChatId`와 meet/call message id를 찾는다.
3. Open API 또는 n8n Channel Talk node로 meet STT messages를 가져온다.
4. webhook 누락/중단에 대비해 2분 polling backup을 둔다.
5. 빌딩/테스트 중 과거 내역은 manual backfill workflow로 가져온다.
6. STT 메시지가 없으면 이번 MVP에서는 `skipped_no_transcript` 또는 `fallback_pending` 상태로 저장한다. call recording 다운로드와 우리 쪽 STT fallback은 후속 Phase로 둔다.

## 확인한 근거

### Channel Talk 제품 기능

Channel Talk Meet/Phone 제품 설명에는 call recordings, AI summaries, live transcripts, analytics가 포함되어 있다. 즉 플랜/설정이 맞으면 통화가 채널톡 안에서 전사/요약 가능한 자료로 남는다는 가정을 둘 수 있다.

### n8n Channel Talk node

n8n의 verified Channel Talk integration에는 User Chat operation으로 다음 기능이 있다.

- `Get Meets Messages`: STT chat 메시지 목록 조회
- `Get Meets Recording`: call meet 녹음 다운로드
- `Get Messages`: chat 메시지 목록 조회
- `Get Cases`: 시간 범위 안의 user chat case 목록 조회

이 조합이면 별도 커스텀 코드 없이도 n8n에서 transcript 또는 recording을 가져올 가능성이 높다.

### Channel Talk Open API

공개 OpenAPI spec에서 확인한 핵심 endpoint:

```text
GET /open/v5/meet/call/log
GET /open/v5/user-chats/{userChatId}/messages
GET /open/v5/user-chats/{userChatId}/meets/{messageId}/messages
GET /open/v5/user-chats/{userChatId}/meets/{messageId}/recording
```

중요한 동작:

- `GET /open/v5/meet/call/log`: 시간 범위 내 call log 반환. `CallLog`에는 `userChatId`, `direction`, `state`, `from`, `to`, `createdAt`, `engagedAt`, `closedAt`, `managerIds` 등이 포함된다.
- `GET /open/v5/user-chats/{userChatId}/messages`: chat messages 반환. meet 관련 message/root를 찾는 데 사용한다.
- `GET /open/v5/user-chats/{userChatId}/meets/{messageId}/messages`: STT chat 메시지 목록 반환.
- `GET /open/v5/user-chats/{userChatId}/meets/{messageId}/recording`: call meet recording 다운로드용 signed URL 반환. recording은 `audio/mp4`이고 signed URL은 15분 동안 유효하다고 문서화되어 있다.

`message.meet.MessageMeet` 상태에는 다음 값이 있다.

```text
live
ended
transcribing
transcribed
transcribeFailed
```

따라서 `transcribed`까지 기다렸다가 transcript를 가져온다. `transcribeFailed`이면 이번 MVP에서는 `fallback_pending` 상태로 저장하고, recording fallback 실행은 후속 Phase로 둔다.

## 권장 n8n Flow

### Flow A: Webhook-first

```text
Channel Talk Webhook
  -> n8n Webhook node
  -> IF message/userChat has meet data
  -> Wait/Poll until meet.state == transcribed
  -> Channel Talk: Get Meets Messages
  -> Normalize transcript
  -> HTTP Request: POST Phone-Claw /api/ingest/channel-talk
```

후속 Phase Fallback:

```text
If no transcript or meet.state == transcribeFailed
  -> Channel Talk: Get Meets Recording
  -> Download audio/mp4
  -> POST audio URL/file to Phone-Claw local bridge
  -> local STT
```

### Flow B: Polling backup

```text
Schedule Trigger every 2 minutes
  -> HTTP Request GET /open/v5/meet/call/log?from=lastRun&to=now
  -> For each call log, get userChatId
  -> Get user chat messages
  -> Find meet root message
  -> Get Meets Messages
  -> POST transcript to Phone-Claw /api/ingest/channel-talk
```

Webhook event coverage가 message 중심일 수 있으므로, webhook-first로 가더라도 polling backup을 반드시 둔다.

### Flow C: Manual historical backfill

```text
Manual Trigger
  -> Set dateFrom/dateTo/userChatId optional
  -> GET /open/v5/meet/call/log or user chat cases for range
  -> Split in batches
  -> Get user chat messages
  -> Find meet root message
  -> Get Meets Messages
  -> POST transcript to Phone-Claw /api/ingest/channel-talk
```

Manual backfill은 개발/테스트 중 과거 내역을 다시 불러오기 위한 경로다. polling cursor는 수정하지 않고, 중복 방지는 Phone-Claw dedupe에 맡긴다.

## 우리 데모 앱 입력 형태

n8n은 local bridge에 아래처럼 정규화된 payload를 보낸다.

```json
{
  "source": "channel_talk_n8n",
  "mode": "call",
  "channelId": "...",
  "userChatId": "...",
  "meetMessageId": "...",
  "callDirection": "inbound",
  "startedAt": "2026-05-30T15:30:00+09:00",
  "endedAt": "2026-05-30T15:34:00+09:00",
  "participants": [
    { "id": "customer", "role": "counterparty" },
    { "id": "manager", "role": "user" }
  ],
  "transcript": [
    {
      "speaker": "customer",
      "text": "어제 장애 때문에 주문 전환율이 떨어졌습니다."
    }
  ],
  "recordingUrl": "https://signed-url-if-needed"
}
```

우리 앱은 이 payload를 받아 다음 순서로 처리한다.

```text
Channel Talk transcript
  -> VoiceSessionRecord / CallRecord
  -> EXAONE summary/action/risk extraction
  -> agent-input.json
  -> MISO payload
```

## 제출 데모 반영

Channel Talk+n8n은 이제 "MVP 후 확장 후보"가 아니라 제출 데모에서 보여줄 두 번째 입력이다. 또한 개발 착수 순서는 n8n ingest/storage를 먼저 만든다. 이 단계에서는 transcript 세션이 `pending_processing` 상태로 쌓여도 된다. core STT/EXAONE pipeline은 Mac 로컬 웹앱 골든패스를 만들면서 같은 세션 계약에 연결한다.

데모 화면에서 보여줄 흐름:

```text
Mac local web app
  -> local STT
  -> local EXAONE
  -> review / MISO payload

Channel Talk phone
  -> n8n normalized payload
  -> webhook-first / polling backup / manual backfill
  -> /api/ingest/channel-talk
  -> pending_processing session 저장
  -> 이후 same EXAONE / review / MISO payload
```

구현 범위:

1. `channel_talk_n8n` adapter를 만든다.
2. `/api/ingest/channel-talk` endpoint가 n8n payload를 받는다.
3. `source/channel-talk.payload.json`에 원본 payload를 저장한다.
4. transcript 배열을 `source/channel-transcript.raw.md`와 `transcript/transcript.raw.md`로 변환한다.
5. 이후 `VoiceSessionDraft -> EXAONE -> Review -> handoff/miso-payload.redacted.json`은 기존 pipeline을 재사용한다.

데모 안전장치:

- live Channel Talk 토큰/플랜/통화 데이터가 있으면 webhook-first n8n flow를 사용한다.
- webhook 누락/중단에 대비해 2분 polling backup을 둔다.
- 빌딩/테스트 중에는 manual historical backfill workflow로 과거 내역을 다시 가져올 수 있게 한다.
- live 연결이 막히면 n8n Manual Trigger/Set node가 sample payload로 같은 endpoint를 호출한다.
- n8n cloud가 로컬 Mac의 `localhost`에 접근하지 못하면 n8n을 로컬에서 실행하거나, 짧은 데모용 tunnel을 쓴다. 기본 데모는 로컬 n8n Manual Trigger/Set node로 같은 payload를 흘린다.
- 발표에서는 "실제 운영에서는 Channel Talk webhook 또는 polling backup workflow가 이 normalized payload를 만든다"고 설명한다.

## 리스크

- Channel Talk 플랜, 국가, Phone/Meet recording/transcription 설정에 따라 기능 제공 여부가 달라질 수 있다.
- webhook이 모든 통화 lifecycle transition을 보장한다고 가정하면 위험하다.
- signed recording URL은 15분 안에 다운로드하거나 전달해야 한다.
- transcript가 하나의 문서가 아니라 STT chat message 목록일 수 있으므로 timestamp 순서로 병합해야 한다.
- 통화 녹음/전사에는 개인정보가 들어갈 수 있으므로 동의와 보관 범위를 데모에서 명확히 해야 한다.

## Sources

- https://channel.io/en/meet/call
- https://n8n.io/integrations/channel-talk/
- https://developers.channel.io/en/articles/Webhook-events-7bd9b8e2
- https://developers.channel.io/en/categories/Open-API-060776bd
- https://api-doc.channel.io/
