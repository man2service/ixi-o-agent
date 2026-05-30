# n8n Automation Hub Plan

> 작성일: 2026-05-30 KST
> 결정: Phone-Claw는 Channel Talk 입력부터 n8n을 기본 자동화 허브로 붙인다.
> 최신 업데이트: 개발 착수 순서는 `n8n ingest/storage`를 먼저 만들고, 수집 방식은 `webhook-first + polling backup + manual backfill`로 둔다.
> 목적: 이후 다른 입력/후속 작업도 같은 방식으로 확장할 수 있게 n8n의 역할과 경계를 고정한다.

---

## 1. 결론

n8n은 이번 프로젝트에서 단순 데모 도구가 아니다. Phone-Claw 주변의 자동화 허브로 둔다.

```text
External systems / SaaS / scheduled jobs
  -> n8n workflows
  -> Phone-Claw ingest endpoints
  -> local session storage
  -> STT/EXAONE/review/handoff pipeline
```

첫 연결은 Channel Talk 전화/Meet 전사문이다.

```text
Channel Talk phone/meet transcript
  -> n8n sample workflow first
  -> n8n webhook workflow for realtime ingest
  -> n8n polling workflow as backup
  -> n8n manual backfill workflow for historical import
  -> POST /api/ingest/channel-talk
  -> {storageDir}/sessions/{sessionId}
```

여기서 "n8n-first"는 Phone-Claw의 핵심 처리 철학을 바꾸는 뜻이 아니다. 원본 음성의 로컬 STT/EXAONE 골든패스는 그대로 두되, 실제 개발은 외부 전사문을 쌓아두는 ingest 레이어부터 만든다는 뜻이다.

## 2. 왜 n8n을 먼저 붙이는가

- 사용자가 다른 기능을 구현하는 동안에도 전사문/상담 payload를 자동으로 쌓을 수 있다.
- Channel Talk 이후에도 Slack, Email, MISO 실험, ixiO adapter, scheduled cleanup 같은 후속 작업을 같은 방식으로 붙일 수 있다.
- 해커톤 데모에서 "Voice input -> workflow automation -> agent-ready output" 그림이 더 선명해진다.
- MISO에 직접 push할 표준 ingest API가 아직 불확실하므로, n8n이 외부 시스템과 Phone-Claw 사이의 완충 레이어가 된다.

## 3. n8n의 책임

n8n이 담당한다:

- 외부 서비스 credential 보관
- schedule/webhook trigger
- Channel Talk API 호출
- sample payload 주입
- API 응답 normalize
- Phone-Claw ingest endpoint 호출
- 실패 시 재시도 또는 execution log 확인

Phone-Claw가 담당한다:

- payload schema validation
- session folder 생성
- source payload 저장
- transcript markdown 변환
- dedupe 처리
- local STT/EXAONE/review/handoff pipeline
- 민감정보 마스킹과 외부 전달 승인

## 4. 초기 워크플로우

### 4.1 Sample Ingest Workflow

첫 n8n workflow로 구현한다. 단, 코드 구현 순서는 `config/storageDir`, secret 검증, payload schema, session store, `/api/ingest/channel-talk` endpoint가 먼저다.

```text
Manual Trigger
  -> Set node: channel-talk-normalized payload
  -> HTTP Request: POST Phone-Claw /api/ingest/channel-talk
  -> optional: execution result display
```

목적:

- n8n이 실제로 Phone-Claw endpoint를 호출할 수 있는지 확인
- Phone-Claw 세션 저장 구조 확인
- 이후 live Channel Talk API 응답을 같은 schema로 바꿔 끼울 준비

### 4.2 Polling Ingest Workflow

webhook 다음의 백업 경로로 구현한다.

```text
Schedule Trigger every 2 minutes
  -> Channel Talk Open API / call or user chat lookup
  -> Get userChatId / meetMessageId
  -> Get Meets Messages
  -> Normalize transcript
  -> HTTP Request: POST Phone-Claw /api/ingest/channel-talk
```

목적:

- 사용자가 다른 개발을 하는 동안 Channel Talk 전사문을 누적
- webhook 누락, n8n 재시작, tunnel 중단을 보완

### 4.3 Realtime Webhook Workflow

실시간 수집 기본 경로다.

```text
Channel Talk Webhook
  -> n8n Webhook Trigger
  -> validate event signature/secret if available
  -> extract userChatId / meetMessageId
  -> Wait or retry until transcript is ready
  -> Get Meets Messages
  -> Normalize transcript
  -> HTTP Request: POST Phone-Claw /api/ingest/channel-talk
```

주의:

- Channel Talk가 로컬 n8n으로 webhook을 보내려면 n8n webhook URL이 외부에서 접근 가능해야 한다.
- 로컬 n8n Docker를 유지하려면 tunnel이 필요하다.
- n8n Test webhook URL은 개발 중 디버깅용으로 쓰고, 실제 자동 수집은 Production webhook URL을 사용한다.

### 4.4 Manual Backfill Workflow

빌딩/테스트 중 과거 내역을 다시 불러오기 위한 수동 경로다.

```text
Manual Trigger
  -> Set dateFrom/dateTo/userChatId optional
  -> Channel Talk call/case lookup for range
  -> Split in batches
  -> Get user chat messages
  -> Find meet message
  -> Get Meets Messages
  -> Normalize transcript
  -> HTTP Request: POST Phone-Claw /api/ingest/channel-talk
```

원칙:

- manual backfill은 `lastSuccessfulPollAt`을 바꾸지 않는다.
- 중복 방지는 Phone-Claw dedupe가 담당한다.
- 기본 조회 범위는 최근 24시간, 필요하면 사용자가 date range를 넣는다.
- 오래된 내역 import는 데모/개발용이며, 개인정보가 포함될 수 있으므로 실행 결과 저장 정책을 지킨다.

### 4.5 Recording Fallback Workflow

이번 MVP 구현 범위에서는 제외한다. 문서와 상태값만 남긴다.

```text
If transcript missing or transcribe failed in a later phase
  -> Get Meets Recording
  -> pass recordingUrl or downloaded file reference
  -> Phone-Claw local STT fallback
```

이번 1차 구현에서는 transcript-only로 시작한다. transcript가 없거나 `transcribeFailed`인 통화는 `skipped_no_transcript` 또는 `fallback_pending` 상태로 저장하고, 실제 recording 다운로드/STT fallback은 후속 작업으로 미룬다.

## 5. 실행 위치 결정

기본:

```text
로컬 n8n Docker 우선
```

이유:

- Phone-Claw local bridge와 같은 Mac에서 통신하기 쉽다.
- 원본/전사문을 최대한 로컬 쪽에 두는 제품 메시지와 맞다.
- n8n Cloud는 Mac의 `localhost`에 접근할 수 없어 tunnel/public endpoint가 필요하다.

주의:

- n8n을 Docker로 띄우면 컨테이너 안의 `localhost`는 Mac host가 아니다.
- Docker n8n에서 Mac host의 Phone-Claw를 부를 때는 보통 `host.docker.internal`을 사용한다.
- Channel Talk webhook을 직접 받으려면 tunnel 또는 public endpoint가 필요하다.

로컬 Docker 기준 endpoint:

```text
N8N_URL=http://localhost:5678
PHONE_CLAW_INGEST_URL=http://host.docker.internal:3000/api/ingest/channel-talk
```

## 6. 보안 원칙

- Channel Talk API key는 n8n credential 또는 `.env`에만 둔다.
- `Access Key`, `Access Secret`은 GitHub, 문서, 스크린샷에 노출하지 않는다.
- n8n -> Phone-Claw 호출에는 `PHONE_CLAW_INGEST_SECRET` shared secret을 둔다.
- Channel Talk 입력은 Private Mode가 아니라 Integration Mode로 표시한다.
- MISO에는 원본 음성/원문 전사문을 보내지 않고 redacted payload만 준비한다.

n8n execution data 보관 정책:

```text
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=24
```

n8n은 장기 저장소가 아니다. 성공 payload 장기 보관은 Phone-Claw session folder만 신뢰한다.

## 7. 저장 산출물

n8n을 통해 들어온 Channel Talk 세션은 아래처럼 저장한다.

```text
{storageDir}/sessions/{sessionId}/
  metadata.json
  source/
    channel-talk.payload.json
    channel-transcript.raw.md
  transcript/
    transcript.raw.md
  agent/
    voice-session-draft.json
  review/
    review-state.json
  handoff/
    miso-payload.redacted.json
```

## 8. 구현 산출물

예상 파일:

```text
sample-data/
  channel-talk-normalized.json

n8n/
  workflows/
    channel-talk-sample-ingest.json
    channel-talk-polling-ingest.json

apps/local-web/
  src/app/api/ingest/channel-talk/route.ts

packages/adapters/
  src/channel-talk/

packages/core/
  src/schema/
```

## 9. 구현 순서

이번 결정으로 구현 순서는 아래로 고정한다.

```text
1. config/local.json 또는 env에서 storageDir 읽기
2. `x-phone-claw-ingest-secret` header로 PHONE_CLAW_INGEST_SECRET 검증
3. channel_talk_n8n payload schema 검증
4. session store + dedupe index 생성
5. POST /api/ingest/channel-talk 구현
6. sessions/{sessionId}/source 저장
7. transcript.raw.md 생성
8. sample-data/channel-talk-normalized.json 작성
9. n8n sample ingest workflow 작성
10. n8n local 실행 문서 작성
11. Channel Talk HTTP Request polling workflow 초안 작성
12. 쌓인 transcript session을 EXAONE pipeline으로 넘기는 처리 버튼/queue 연결
13. Mac local recording/file upload 골든패스 연결
```

초기에는 Channel Talk transcript 세션이 `pending_processing` 상태로 쌓여도 괜찮다. 중요한 것은 n8n이 들어오는 자료를 잃지 않고 같은 세션 계약으로 저장하는 것이다.

## 10. 현재 기본 결정

| 항목 | 결정 |
|---|---|
| n8n 실행 위치 | 로컬 n8n Docker 우선, npm/desktop은 fallback |
| Phone-Claw 호출 방식 | 로컬 n8n이면 `http://host.docker.internal:3000` 또는 Mac host URL 사용 |
| 첫 workflow | Manual Trigger + Set node + HTTP Request |
| live 수집 | Webhook-first |
| backup 수집 | HTTP Request node 기반 polling |
| manual backfill | date range 기반 과거 내역 수동 import |
| Channel Talk verified node | 나중에 설치 가능. 1차는 HTTP Request node |
| transcript 없는 통화 | 1차는 `skipped_no_transcript` 또는 `fallback_pending`, recording fallback은 후속 |
| polling 주기 | 2분 기본, 데모 중에는 manual 실행 |
| polling cursor | n8n static data에 `lastSuccessfulPollAt` 저장 |
| 인증 | `x-phone-claw-ingest-secret: <PHONE_CLAW_INGEST_SECRET>` header |
| n8n execution data | success 저장 off, error 저장 on, max age 24h |
| sample ingest acceptance | endpoint 호출, 세션/파일 생성, duplicate 재호출 무해성까지 확인 |
| transcript 없는 통화 상태 | 빈 transcript는 `skipped_no_transcript`, `transcribeFailed`는 `fallback_pending` |

## 11. 구현 전 고정값

### 11.1 Dedupe Key

기본:

```text
dedupeKey = channelId + userChatId + meetMessageId
```

fallback:

```text
dedupeKey = channelId + userChatId + startedAt + endedAt
```

`callLogId`를 Channel Talk API 응답에서 안정적으로 얻으면 후속으로 아래를 우선할 수 있다.

```text
dedupeKey = channelId + callLogId
```

### 11.2 Polling Cursor

1차 구현:

```text
n8n static data에 lastSuccessfulPollAt 저장
```

Phone-Claw는 session dedupe를 최종 방어선으로 둔다. n8n cursor가 흔들려 같은 payload가 다시 들어와도 endpoint는 idempotent하게 동작해야 한다.

Manual backfill은 polling cursor를 수정하지 않는다.

### 11.3 Empty Transcript Rule

`transcript: []`는 허용한다. 단, 상태를 분리한다.

```json
{
  "source": "channel_talk_n8n",
  "status": "skipped_no_transcript",
  "reason": "meet_not_transcribed_yet",
  "transcript": []
}
```

처리 규칙:

- `status = ready`이고 transcript가 있으면 세션 생성/갱신
- `status = skipped_no_transcript`이면 source payload만 저장하거나 200 skipped 응답
- `status = fallback_pending`이면 recording fallback queue 후보로 둠
- 1차 구현에서는 `fallback_pending`을 저장만 하고 로컬 STT는 실행하지 않음

### 11.4 Endpoint Response Contract

```json
{
  "ok": true,
  "result": "created | duplicate | updated | skipped_no_transcript | fallback_pending",
  "sessionId": "2026-05-30_173012_channel_talk_demo",
  "dedupeKey": "channel-demo:user-chat-demo:meet-message-demo"
}
```

HTTP status:

```text
200 created / duplicate / updated / skipped_no_transcript / fallback_pending
400 validation error
401 invalid ingest secret
500 unexpected server error
```

### 11.5 Sample Ingest Acceptance Criteria

sample workflow가 합격하려면 아래가 모두 되어야 한다.

- n8n Manual Trigger로 Phone-Claw endpoint 호출 성공
- session folder 생성
- `source/channel-talk.payload.json` 생성
- `source/channel-transcript.raw.md` 생성
- `transcript/transcript.raw.md` 생성
- 같은 payload를 한 번 더 보내면 `duplicate` 응답
- duplicate 재호출이 기존 세션을 망가뜨리지 않음

## 12. 이후 확장 후보

n8n에 붙일 수 있는 다음 작업:

- Slack 음성/파일 입력 감지
- Email attachment/audio 입력 감지
- Channel Talk 통화 후 특정 조건이면 follow-up task 생성
- MISO `/ext/v1/chat` 실험 호출
- redacted payload를 Google Drive/Notion/Slack에 저장
- ixiO adapter가 열렸을 때 같은 ingest endpoint로 전달
- nightly cleanup / archive workflow

## 13. 남은 결정

1. `PHONE_CLAW_INGEST_SECRET` 생성 방식을 `openssl rand` 같은 로컬 생성으로 둘지, 사용자가 직접 입력하게 할지
2. Channel Talk API에서 meet root message를 찾는 구체 로직을 call log 기준으로 먼저 구현할지, user chat messages 기준으로 먼저 구현할지
