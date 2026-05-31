# Channel Talk + n8n Implementation Prerequisites

> 작성일: 2026-05-30 KST
> 목적: Channel Talk 전화/Meet 전사문을 n8n으로 먼저 끌어와 ixi-O Agent 입력으로 쌓기 위해 사용자가 미리 처리하거나 결정해야 할 항목 정리
> 결정: n8n을 기본 자동화 허브로 사용
> 구현 우선순위: `ixi-O Agent ingest endpoint` -> `n8n sample workflow` -> `Channel Talk webhook realtime ingest` -> `n8n HTTP Request polling backup` -> `manual historical backfill` -> `fallback status only`
> 최신 결정: 다른 기능을 붙이기 전에 n8n을 먼저 연결한다. STT/EXAONE 처리는 뒤에 붙더라도 transcript session은 먼저 누적한다.

---

## 1. 결론

채널톡 전사문 수집은 n8n을 기본 경유 레이어로 둔다. 이유는 단순히 채널톡 하나를 붙이기 위해서가 아니라, 이후 Slack/Email/MISO 실험/ixiO adapter 같은 추가 작업도 n8n workflow로 이어 붙이기 위해서다.

처음부터 live 통화를 완전 자동 수집하려고 하지는 않는다. 다만 sample payload도 **n8n workflow를 통해** ixi-O Agent로 보낸다.

가장 안전한 순서:

```text
1. ixi-O Agent /api/ingest/channel-talk endpoint 구현
2. n8n sample workflow에서 `sample-data/channel-talk-normalized.json` 형태 payload POST
3. ixi-O Agent 세션 저장/중복 방지/전사문 누적 확인
4. Channel Talk webhook을 n8n으로 받아 realtime ingest 구성
5. webhook 누락에 대비해 2분 polling backup 구성
6. 빌딩/테스트용 manual historical backfill 구성
7. transcript가 없을 때는 이번 MVP에서 `skipped_no_transcript` 또는 `fallback_pending` 상태로 저장
```

이렇게 하면 사용자가 다른 구현을 하는 동안에도 n8n이 Channel Talk 쪽 payload/전사문을 같은 로컬 세션 폴더에 쌓아둘 수 있다.

처리 파이프라인이 아직 완성되지 않은 경우 세션 상태는 아래처럼 둔다.

```text
status = pending_processing
reason = transcript_ingested_before_exaone_pipeline_ready
```

이후 EXAONE pipeline이 준비되면 이미 쌓인 세션을 batch 또는 수동 버튼으로 후처리한다. 실제 recording fallback 다운로드와 로컬 STT 처리는 이번 MVP 후속으로 둔다.

## 2. 사용자가 먼저 해야 할 일

### 2.1 Channel Talk 계정/워크스페이스

필수:

- Channel Talk 계정 생성 또는 기존 워크스페이스 접근 권한 확보
- Channel Desk 관리자 화면 접근
- `Settings` -> `API Key management` 접근 권한
- Open API credential 생성
  - `Access Key`
  - `Access Secret`

공식 문서 확인:

- Channel Open API는 모든 요청에 인증이 필요하다.
- Channel Desk의 `Settings` -> `API Key management`에서 credential을 만든다.
- 생성된 credential은 `Access Key`와 `Access Secret`으로 구성된다.
- HTTP 요청 header에는 `x-access-key`, `x-access-secret`을 넣는다.

Source:

- https://developers.channel.io/en/articles/Authentication-20516f31

### 2.2 Channel Talk Meet/전화 기능

필수 확인:

- 사용 중인 Channel Talk 워크스페이스에서 Meet Audio 또는 전화 기능을 사용할 수 있는지
- 고객/테스트 사용자가 실제로 Meet/전화 상담을 만들 수 있는지
- 전사문 또는 STT chat messages가 남는 플랜/설정인지
- 녹음 파일 다운로드가 가능한지
- 테스트 통화를 1~2건 만들 수 있는지

공식 문서상 Meet Audio는 고객/팀원과 음성 통화를 할 수 있고, `Channel Settings` -> `Meets` -> `Voice, Video Meets`에서 켤 수 있다. Meet 버튼은 담당자가 배정되어 있고 입력창이 열린 상담에서 노출된다.

Source:

- https://docs.channel.io/help/en/articles/Meet-Audio--40d04459
- https://channel.io/en/meet/call

### 2.3 n8n 계정 또는 로컬 n8n

기본 결정은 **n8n을 붙이고 로컬 n8n Docker를 우선 사용한다**이다.

기본 A: 로컬 n8n Docker

- 장점: 실행 방식이 재현 가능하고 팀원이 같은 workflow를 가져가기 쉽다.
- 단점: Channel Talk webhook을 받으려면 외부에서 접근 가능한 URL/tunnel이 필요하다.

Fallback B: 로컬 n8n npm/desktop

- 장점: Docker 없이 빠르게 띄울 수 있고 `localhost` 호출이 단순하다.
- 단점: 설치 환경 차이가 생길 수 있다.

Fallback C: n8n Cloud

- 장점: webhook URL이 외부에서 접근 가능하다.
- 단점: n8n Cloud에서 내 Mac의 `localhost`는 접근할 수 없다. ixi-O Agent endpoint를 tunnel로 열거나, 중간 public endpoint가 필요하다.

이번 구현 결정:

```text
초기 구현: n8n sample workflow -> ixi-O Agent /api/ingest/channel-talk
실시간 연결: Channel Talk webhook -> n8n Webhook Trigger -> ixi-O Agent
백업 연결: n8n Schedule Trigger -> Channel Talk Open API polling -> ixi-O Agent
수동 테스트: n8n Manual Trigger -> date range backfill -> ixi-O Agent
```

실제 ixi-O Agent endpoint 주소는 n8n 실행 방식에 따라 다르게 둔다.

```text
# n8n이 Docker container일 때
IXI_O_AGENT_INGEST_URL=http://host.docker.internal:3000/api/ingest/channel-talk

# n8n이 같은 Mac의 npm/desktop process일 때
IXI_O_AGENT_INGEST_URL=http://localhost:3000/api/ingest/channel-talk

# n8n Cloud일 때
IXI_O_AGENT_INGEST_URL=https://<tunnel-or-public-url>/api/ingest/channel-talk
```

Source:

- https://n8n.io/integrations/channel-talk/
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/

### 2.4 n8n Channel Talk node 설치 여부

n8n의 Channel Talk integration은 verified node로 제공되며, User Chat 쪽에 아래 기능이 있다.

- `Get Meets Messages`: STT chat message 목록 조회
- `Get Meets Recording`: call meet recording 다운로드
- `Get Messages`: chat message 목록 조회
- `Get Cases`: 시간 범위 안 user chat case 목록 조회

다만 verified community node는 instance owner가 먼저 setup해야 한다. 이번 1차 구현은 설치 변수를 줄이기 위해 n8n `HTTP Request` node로 Channel Talk Open API를 직접 호출한다. verified node는 live 연결이 안정화된 뒤 보너스로 검토한다.

Source:

- https://n8n.io/integrations/channel-talk/
- https://docs.n8n.io/integrations/community-nodes/installation/verified-install/

## 3. 사용자가 정해야 할 선택지

### 결정 1: n8n 실행 위치

추천: `로컬 n8n Docker`

선택지:

| 선택 | 장점 | 리스크 |
|---|---|---|
| 로컬 n8n Docker | 실행 재현성이 좋고 `host.docker.internal` 기준 문서화가 쉽다 | Docker 준비 필요 |
| 로컬 n8n npm/desktop | 빠르게 띄울 수 있고 `localhost` 호출이 단순하다 | 설치 환경 차이가 생길 수 있음 |
| n8n Cloud | webhook URL 운영 쉬움 | 내 Mac localhost 접근 불가 |

이번 선택:

```text
기본: 로컬 n8n Docker
fallback: npm/desktop
보조: n8n Cloud는 외부 webhook/tunnel이 필요할 때만 검토
제외: n8n 없이 local script만 쓰는 방식
```

### 결정 2: live API 우선 vs sample payload 우선

결정: `n8n sample workflow 우선`

이유:

- Channel Talk 플랜/권한/전사 상태가 현장에서 흔들릴 수 있다.
- 저장 파이프라인을 먼저 만들면 나중에 live 데이터만 바꿔 끼우면 된다.
- n8n에서 `Set` node 또는 pinned data로 같은 payload를 흘릴 수 있다.
- 처음부터 n8n을 경유하므로, 나중에 다른 자동화도 같은 방식으로 이어 붙일 수 있다.

### 결정 3: Webhook-first vs Polling-first

결정: `Webhook-first + Polling backup`

이유:

- 사용자가 원하는 제품 경험은 통화/상담 후 최대한 빠르게 전사문이 쌓이는 것이다.
- webhook은 실시간성에 유리하다.
- 다만 webhook 누락, tunnel 중단, n8n 재시작, 전사 완료 지연 가능성이 있으므로 polling을 백업으로 둔다.

Realtime webhook:

```text
Channel Talk Webhook
  -> n8n Webhook Trigger
  -> userChatId / meetMessageId 추출
  -> Wait or retry until transcript is ready
  -> Get Meets Messages
  -> Normalize
  -> POST ixi-O Agent /api/ingest/channel-talk
```

Backup polling:

```text
Schedule Trigger every 2 minutes
  -> Channel Talk call/case lookup
  -> userChatId / meetMessageId 추출
  -> Get Meets Messages
  -> Normalize
  -> POST ixi-O Agent /api/ingest/channel-talk
```

Manual historical backfill:

```text
Manual Trigger
  -> Set dateFrom/dateTo/userChatId optional
  -> Channel Talk call/case lookup for range
  -> Split in batches
  -> Get Meets Messages
  -> Normalize
  -> POST ixi-O Agent /api/ingest/channel-talk
```

Manual backfill은 `lastSuccessfulPollAt`을 바꾸지 않는다.

### 결정 4: transcript-only vs recording fallback

결정: `transcript-only로 시작`

이유:

- 우리는 이미 STT/EXAONE 로컬 pipeline을 따로 만들 계획이다.
- Channel Talk 입력은 "이미 SaaS에 있는 통화 전사문을 가져오는 Integration Mode"로 먼저 보여주는 편이 낫다.
- recording fallback은 signed URL 만료/다운로드/저장/동의 이슈가 붙는다.

## 4. 우리가 구현할 최소 계약

### 4.1 Endpoint

```text
POST /api/ingest/channel-talk
Content-Type: application/json
x-ixi-o-agent-ingest-secret: <IXI_O_AGENT_INGEST_SECRET>
```

### 4.2 Request payload

```json
{
  "source": "channel_talk_n8n",
  "mode": "call",
  "channelId": "channel-demo",
  "userChatId": "user-chat-demo",
  "meetMessageId": "meet-message-demo",
  "callDirection": "inbound",
  "startedAt": "2026-05-30T15:30:00+09:00",
  "endedAt": "2026-05-30T15:34:00+09:00",
  "participants": [
    { "id": "customer", "role": "counterparty", "displayName": "고객" },
    { "id": "manager", "role": "user", "displayName": "상담원" }
  ],
  "transcript": [
    {
      "speaker": "customer",
      "text": "어제 장애 때문에 주문 전환율이 떨어졌습니다.",
      "timestampMs": 0
    }
  ],
  "recordingUrl": null
}
```

### 4.2.1 Payload 규칙

필수:

- `source`: 반드시 `channel_talk_n8n`
- `mode`: `call`
- `channelId`
- `userChatId`
- `startedAt`
- `participants`
- `transcript`

선택:

- `meetMessageId`
- `endedAt`
- `callDirection`: `inbound | outbound | unknown`
- `recordingUrl`: 이번 MVP에서는 저장만 허용하고 다운로드하지 않음

transcript 규칙:

- `transcript[]`는 비어 있을 수 있다. 비어 있으면 세션 상태는 `skipped_no_transcript`.
- `timestampMs`는 milliseconds 기준이다.
- `speaker`는 participant `id`와 맞추는 것을 기본으로 한다.
- 정렬 기준은 `timestampMs`, 없으면 입력 배열 순서다.

### 4.3 저장 위치

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

### 4.4 중복 방지 키

처음 구현에서는 아래 조합으로 중복 수집을 막는다.

```text
source = channel_talk_n8n
dedupeKey = channelId + userChatId + meetMessageId
```

`meetMessageId`가 없으면 아래 fallback을 쓴다.

```text
dedupeKey = channelId + userChatId + startedAt + endedAt
```

중복 POST 응답:

```text
새 세션: 200 created
이미 있는 세션: 200 duplicate
같은 dedupeKey인데 payload hash가 바뀐 경우: 200 updated, source/channel-talk.payload.v2.json 보존
schema 오류: 400 invalid_payload
secret 오류: 401 unauthorized
```

표준 response body:

```json
{
  "ok": true,
  "result": "created | duplicate | updated | skipped_no_transcript | fallback_pending",
  "sessionId": "2026-05-30_173012_channel_talk_demo",
  "dedupeKey": "channel-demo:user-chat-demo:meet-message-demo"
}
```

## 5. 사용자가 준비해야 할 값

`.env` 또는 n8n credential에 들어갈 값:

```text
CHANNEL_TALK_ACCESS_KEY=...
CHANNEL_TALK_ACCESS_SECRET=...
CHANNEL_TALK_CHANNEL_ID=...          # 알 수 있으면 저장. API 응답에서 가져와도 됨
IXI_O_AGENT_INGEST_SECRET=...         # n8n -> ixi-O Agent 호출 보호용 shared secret
```

`IXI_O_AGENT_INGEST_URL`은 실행 방식별로 나눈다.

```text
# n8n Docker
IXI_O_AGENT_INGEST_URL=http://host.docker.internal:3000/api/ingest/channel-talk

# n8n npm/desktop
IXI_O_AGENT_INGEST_URL=http://localhost:3000/api/ingest/channel-talk

# n8n Cloud
IXI_O_AGENT_INGEST_URL=https://<tunnel-or-public-url>/api/ingest/channel-talk
```

로컬 n8n 예시:

```text
N8N_URL=http://localhost:5678
IXI_O_AGENT_INGEST_URL=http://host.docker.internal:3000/api/ingest/channel-talk  # n8n이 Docker일 때
IXI_O_AGENT_INGEST_URL=http://localhost:3000/api/ingest/channel-talk             # n8n이 같은 host process일 때
```

주의:

- n8n을 Docker로 띄우면 컨테이너 안의 `localhost`는 Mac host가 아니라 n8n 컨테이너 자신이다.
- 이 경우 Mac host의 ixi-O Agent dev server는 보통 `host.docker.internal`로 접근한다.
- Channel Talk webhook이 로컬 n8n에 도달하려면 tunnel 또는 public endpoint가 필요하다.
- n8n Cloud를 쓰면 `localhost` 접근이 불가능하므로 ixi-O Agent 호출에도 tunnel 또는 public endpoint가 필요하다.
- n8n execution data에는 전사문 payload가 남을 수 있다. 실제 데이터 수집 전에는 성공 실행 저장을 끄거나 보관 기간을 짧게 둔다.

권장 n8n 실행 데이터 설정:

```text
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=24
```

공식 n8n 문서 기준 기본값은 성공 실행 저장 `all`, 오류 실행 저장 `all`, pruning enabled, max age 336시간이다.

### 5.1 Polling cursor

1차 구현에서는 n8n static data에 마지막 성공 poll 시간을 저장한다.

```text
lastSuccessfulPollAt
```

ixi-O Agent의 dedupe 처리가 최종 방어선이다. n8n cursor가 흔들려 같은 payload가 다시 들어와도 endpoint는 `duplicate`로 응답하고 기존 세션을 보존해야 한다.

Manual historical backfill은 `lastSuccessfulPollAt`을 수정하지 않는다.

## 6. 지금 사용자에게 필요한 액션

1. Channel Talk 워크스페이스에 로그인한다.
2. `Settings` -> `API Key management`에서 Open API credential을 만든다. 현재 사용자가 발급받는 중이다.
3. Access Key / Access Secret을 안전한 곳에 저장한다. 채팅/스크린샷/공개 repo에는 올리지 않는다.
4. `Channel Settings` -> `Meets` -> `Voice, Video Meets`가 켜져 있는지 확인한다. 현재 켜져 있는 것으로 확인했다.
5. 테스트 상담/통화 1건을 만든다.
6. 통화 종료 후 채널톡 화면에 전사/요약/녹음이 남는지 확인한다.
7. 로컬 n8n을 실행할 방법을 정한다: Docker / npm / desktop 중 하나.
8. Channel Talk webhook URL을 n8n Webhook Trigger에 연결한다.
9. ixi-O Agent endpoint 보호용 shared secret을 하나 정한다.
10. n8n execution data 보관 설정을 위 권장값에 맞춘다.

## 7. 구현 순서

1. 저장 폴더 설정과 session folder 생성 로직 작성
2. `x-ixi-o-agent-ingest-secret` 검증 추가
3. payload validation 추가
4. session store와 dedupe 처리 추가
5. `/api/ingest/channel-talk` 구현
6. transcript markdown 변환
7. `sample-data/channel-talk-normalized.json` 작성
8. 로컬 n8n sample workflow 작성
9. n8n HTTP Request node에서 ixi-O Agent endpoint POST
10. Channel Talk webhook realtime workflow 작성
11. Channel Talk API credential 연결
12. 2분 polling backup workflow 작성
13. manual historical backfill workflow 작성
14. recording fallback은 이번 MVP 후속으로 문서와 상태값만 둠

## 8. 리스크

- Channel Talk 플랜에 따라 전화/Meet/전사/녹음 기능이 다를 수 있다.
- webhook만으로 통화 종료/전사 완료를 안정적으로 감지하지 못할 수 있다.
- n8n Cloud는 로컬 Mac의 `localhost`를 호출할 수 없다.
- 녹음 URL fallback은 만료 시간, 개인정보 동의, 저장 정책 이슈가 있다.
- Channel Talk 입력은 Private Mode가 아니라 Integration Mode로 표시해야 한다.

## 9. Sources

- Channel Talk Open API authentication: https://developers.channel.io/en/articles/Authentication-20516f31
- Channel Talk Webhook docs: https://developers.channel.io/en/categories/Webhook-36dd60d6
- Channel Talk Webhook events: https://developers.channel.io/docs/webhook-events
- Channel Talk Meet Audio guide: https://docs.channel.io/help/en/articles/Meet-Audio--40d04459
- Channel Talk Meet/Call product page: https://channel.io/en/meet/call
- n8n Channel Talk integration: https://n8n.io/integrations/channel-talk/
- n8n HTTP Request node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- n8n HTTP Request credentials: https://docs.n8n.io/integrations/builtin/credentials/httprequest/
- n8n Webhook node development URLs: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/
- n8n verified community nodes: https://docs.n8n.io/integrations/community-nodes/installation/verified-install/
