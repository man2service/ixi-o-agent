# Private Local Voice Agent Architecture

> 작성일: 2026-05-30 KST
> 목적: "일상의 모든 voice를 에이전트에게 전하는" 제품을 개인정보/회사 기밀 보호형 로컬 구조로 재정의하고, 입력은 adapter 방식으로 단계적 확장
> 기준:
> - 기존 v1 구조: `current/voice-capture-frontdoor-demo-plan.md`
> - LG U+ Track: Voice AI + EXAONE 필수
> - EXAONE은 STT가 아니라 전사문 후처리/구조화 모델로 사용
> - STT와 EXAONE 모두 사용자 소유 Mac 또는 개인 서버에서 실행

---

## 1. 문서 관계

기존 문서 `voice-capture-frontdoor-demo-plan.md`는 그대로 둔다. 그 문서는 통화/회의/음성메모를 하나의 Voice Capture Frontdoor로 넓히는 v1 기준선이다.

이 문서는 v2 방향이다.

> 사용자가 의도적으로 남긴 일상의 음성을 로컬 장비에서 전사하고, 로컬 EXAONE으로 에이전트 입력으로 바꾼 뒤, 사람이 승인한 결과만 외부 워크플로우로 내보낸다.

핵심 변경점:

| 항목 | v1 Voice Capture Frontdoor | v2 Private Local Voice Agent |
|---|---|---|
| 중심 메시지 | 회의/통화/음성메모를 에이전트 입력으로 변환 | 개인정보/기밀 음성을 로컬에서만 처리하고 승인된 결과만 전달 |
| 입력 채널 | 웹/PWA, 파일 업로드, 샘플, Channel Talk | 개발 착수는 Channel Talk+n8n ingest부터, 발표 핵심은 Mac 로컬 웹앱 end-to-end, 이후 iPhone Safari/PWA와 ixiO 앱으로 확장 |
| STT | 로컬 우선, fallback 허용 | 로컬 STT 필수 |
| EXAONE | 로컬 후처리 | 로컬 후처리 필수 |
| 외부 전송 | MISO payload 전달 | Human Review Gate 이후 요약/익명화 payload만 전달 |

## 2. 제품 정의

제품명/슬로건 후보:

> ixi-O Agent Private Voice Bridge: 일상의 모든 voice를 에이전트에게 안전하게 전하는 로컬 브릿지

제품이 해결하는 문제:

- 회의, 통화, 음성메모, 현장 대화가 업무 액션으로 바뀌지 않고 흩어진다.
- 음성에는 개인정보와 회사 기밀이 많아 클라우드 STT/API로 바로 보내기 어렵다.
- 에이전트는 텍스트/JSON 입력을 잘 다루지만, 사용자의 실제 업무 맥락은 음성으로 남는 경우가 많다.

우리의 답:

```text
사용자가 남긴 음성
  -> 사용자 소유 Mac / Mac mini
  -> 로컬 STT
  -> 로컬 EXAONE
  -> agent-ready memory / task / MISO payload
  -> 사용자 검토
  -> 승인된 결과만 외부 전달
```

## 3. 전체 흐름

```text
[Capture]
  - Phase 0: n8n ingest/storage for Channel Talk transcript
  - Phase 1: Mac local web recording / file upload
  - Phase 2: Channel Talk phone/meet live polling via n8n
  - Phase 3: iPhone Safari/PWA recording
  - Phase 4: ixiO app integration

        |
        v

[Private Local Bridge]
  - Mac mini M4: 권장 상시 서버
  - M1 MacBook Air: 이동형/백업 서버
  - localhost 또는 LAN only
  - 원본 음성/전사문 외부 전송 금지

        |
        v

[Local STT]
  - whisper.cpp
  - mlx-whisper
  - output: transcript.raw.md

        |
        v

[Local EXAONE]
  - EXAONE 4.0 1.2B GGUF Q4 기본
  - transcript cleanup
  - summary
  - decisions
  - action items
  - urgency/risk
  - required teams/tools

        |
        v

[Human Review Gate]
  - 원문/요약/액션 확인
  - 민감정보 마스킹
  - 외부 전달 여부 선택

        |
        v

[Agent / MISO]
  - 로컬 agent memory에는 원문 저장 가능
  - MISO에는 승인된 요약/익명화 payload만 전달
```

## 4. 입력 채널 구분과 adapter 계약

개발은 n8n ingest/storage부터 시작한다. n8n이 Channel Talk sample/live payload를 먼저 쌓고, 이후 Mac 로컬 웹앱 입력과 STT/EXAONE core pipeline을 연결한다. 제출 데모에는 Mac 로컬 입력과 Channel Talk+n8n 입력을 같은 adapter 계약으로 노출한다. 내부 구조는 모든 입력을 `VoiceInputAdapter`로 정규화한다.

```ts
type VoiceInputSource =
  | "local_web_recording"
  | "local_file_upload"
  | "iphone_safari_recording"
  | "channel_talk_n8n"
  | "ixio_app"
  | "sample_demo"

type VoiceSessionDraft = {
  sessionId: string
  source: VoiceInputSource
  mode: "meeting" | "call" | "voice_note"
  sensitivity: "private" | "internal" | "external"
  audio?: {
    localPath?: string
    mimeType?: string
    durationSec?: number
  }
  transcript?: {
    rawText?: string
    utterances?: Utterance[]
  }
  metadata?: Record<string, unknown>
}
```

이후 파이프라인은 입력 source와 무관하게 동일하다.

```text
VoiceSessionDraft
  -> STT if needed
  -> EXAONE post-processing
  -> Review Gate
  -> agent-input.local.json
  -> miso-payload.redacted.json
```

### 4.1 Private Mode

개인정보나 회사 기밀이 들어갈 수 있는 기본 경로다.

Phase 1에서 실제 구현하는 입력:

- Mac 브라우저에서 녹음
- Finder에서 녹음 파일 드롭
- 회의 녹음 파일 업로드

후속 Private Mode 입력:

- iPhone Safari에서 로컬/LAN 웹앱 접속 후 녹음

원칙:

- 음성 파일은 사용자 소유 장비로만 이동한다.
- OpenAI, Claude, 외부 STT API로 원본 음성을 보내지 않는다.
- MISO로도 원본 음성/원문 전사문을 보내지 않는다.

### 4.2 Integration Mode

기존 SaaS에 이미 존재하는 상담/통화 데이터를 가져오는 입력이다. 기밀 로컬 처리 경로와는 분리한다.

제출 데모에 포함할 Integration Mode 입력:

- Channel Talk phone/meet via n8n

데모 기준:

- live 권한과 통화 데이터가 준비되면 n8n이 Channel Talk call log/meet STT messages를 가져온다.
- live 연결이 불안정하면 n8n 또는 로컬 sample payload가 같은 `/api/ingest/channel-talk` endpoint를 호출한다.
- 두 경우 모두 `source/channel-talk.payload.json`과 `source/channel-transcript.raw.md`를 저장하고, 이후 EXAONE/Review/MISO payload는 core pipeline을 재사용한다.

주의:

- Channel Talk를 쓰면 상담 기록/전사/녹음이 Channel Talk 인프라에 저장될 수 있다.
- n8n도 실행 위치에 따라 외부 서비스가 될 수 있다.
- 이 모드는 "이미 해당 SaaS에 존재하는 데이터의 후처리"로 설명한다.
- Telegram voice bot과 외부 회의 툴 export는 이번 제출 범위에서 제외한다.

### 4.3 ixiO Integration

ixiO 앱 연동은 최종 목표로 열어둔다. ixiO가 전사문을 제공하면 `transcript.rawText`로 받고, 전사문을 제공하지 못하면 통화 녹음 파일을 받아 로컬 STT로 처리한다.

```text
ixiO app
  -> transcript or audio
  -> ixio_app adapter
  -> VoiceSessionDraft
  -> existing local pipeline
```

## 5. 보안 구역

```text
Red Zone: raw private data
  - audio.original.*
  - transcript.raw.md
  - transcript.cleaned.md
  - speaker labels
  - local full summary

Amber Zone: reviewed structured data
  - action items
  - decisions
  - urgency/risk
  - redacted summary
  - required teams/tools

Green Zone: externally shareable output
  - miso-payload.redacted.json
  - agent-task.redacted.json
  - user-approved notes
```

MISO 또는 외부 agent로 나가는 데이터는 Green Zone만 허용한다.

## 6. 로컬 파일 계약

세션 1건은 아래 구조로 저장한다. 핵심은 **채널에서 넘어온 원본 자료**와 **에이전트가 읽기 쉬운 구조화 결과**를 분리하는 것이다.

```text
{storageDir}/sessions/
  2026-05-30_173012_meeting_demo/
    metadata.json

    source/
      audio.original.m4a
      channel-talk.payload.json
      channel-transcript.raw.md

    transcript/
      transcript.raw.md
      transcript.cleaned.md

    agent/
      voice-session-draft.json
      agent-input.local.json
      tasks.json
      contacts.json
      decisions.json
      open-questions.json

    review/
      redactions.json
      review-state.json

    handoff/
      miso-payload.redacted.json
      proposed-miso-request.json
```

`metadata.json` 예시:

```json
{
  "sessionId": "2026-05-30_173012_meeting_demo",
  "source": "local_web_recording",
  "mode": "meeting",
  "sensitivity": "private",
  "externalAllowed": false,
  "processingHost": "mac-mini-m4",
  "sttEngine": "whisper.cpp",
  "sttModel": "small",
  "postprocessor": "EXAONE-4.0-1.2B-Q4",
  "createdAt": "2026-05-30T17:30:12+09:00"
}
```

`source/` 아래에는 채널별 원본 payload와 전사문을 보존한다.

예:

- `source/audio.original.m4a`
- `source/channel-talk.payload.json`
- `source/ixio.payload.json`
- `source/channel-transcript.raw.md`

`agent/` 아래에는 에이전트가 읽기 편한 정규화 결과를 저장한다.

예:

- `agent/tasks.json`
- `agent/contacts.json`
- `agent/decisions.json`
- `agent/open-questions.json`
- `agent/agent-input.local.json`

`agent-input.local.json`은 원문 링크를 포함할 수 있다. 단, 이 파일은 로컬 agent만 읽는다.

`handoff/miso-payload.redacted.json`은 외부 전달 가능하도록 민감정보를 제거한 구조만 담는다.

## 7. 모델 역할

### STT

STT는 별도 로컬 엔진이 담당한다.

권장:

- M1 MacBook Air 기본형: `whisper.cpp base/small` 또는 `mlx-whisper base/small`
- Mac mini M4: `whisper.cpp small/medium` 또는 `mlx-whisper small/medium`

처리 원칙:

- 긴 녹음은 chunk로 나눈다.
- M1 Air에서는 STT와 EXAONE을 동시에 돌리지 않고 순차 처리한다.
- 데모 음성은 1~5분 길이를 우선 지원한다.

### EXAONE

EXAONE은 전사문을 에이전트 입력으로 바꾸는 후처리 모델이다.

기본:

- `EXAONE-4.0-1.2B-GGUF Q4_K_M`

역할:

- 전사문 정리
- 회의/통화 요약
- 결정사항 추출
- 액션 아이템 추출
- 긴급도/위험도 분류
- 필요한 팀/도구/MISO workflow 후보 추출
- 로컬 agent input과 MISO redacted payload 생성

주의:

- 공개 EXAONE을 STT 모델이라고 말하지 않는다.
- EXAONE 4.5 33B는 M1 Air 기본형 대상이 아니다.

## 8. 기기별 운영 프리셋

### Mac mini M4

권장 메인 서버다.

```text
역할: 항상 켜진 Private Local Bridge
입력: Mac 녹음/파일 업로드, Channel Talk+n8n payload, 이후 iPhone LAN 녹음
STT: whisper.cpp small/medium 또는 mlx-whisper small/medium
EXAONE: EXAONE 4.0 1.2B Q4
저장: private-voice-inbox/
외부 전달: review 이후 redacted payload만
```

### M1 MacBook Air 기본형

이동형/백업 서버로 충분히 가능하다.

```text
역할: 데모용 또는 개인 이동형 처리기
입력: 파일 업로드, 짧은 웹 녹음, n8n sample Channel Talk payload
STT: whisper.cpp base/small
EXAONE: EXAONE 4.0 1.2B Q4
처리 방식: STT -> EXAONE 순차 실행
주의: 긴 회의는 chunk 분할, medium 이상은 느릴 수 있음
```

## 9. MVP 구현 순서

1. 저장 폴더 설정과 `{storageDir}/sessions/{sessionId}` 생성 로직을 만든다.
2. `IXI_O_AGENT_INGEST_SECRET` 검증 규칙을 둔다.
3. `/api/ingest/channel-talk` endpoint를 만든다.
4. `channel_talk_n8n` adapter가 n8n normalized payload를 `VoiceSessionDraft`로 바꾼다.
5. `source/channel-talk.payload.json`, `source/channel-transcript.raw.md`, `transcript/transcript.raw.md`를 저장한다.
6. `channelId + userChatId + meetMessageId` 기준 dedupe를 붙인다.
7. n8n sample workflow가 같은 endpoint를 호출하게 한다.
8. Channel Talk live 연결이 안 되면 같은 schema의 n8n sample payload로 endpoint를 호출한다.
9. Channel Talk HTTP Request polling workflow 초안을 만든다.
10. Mac 로컬 웹 녹음/파일 업로드 화면을 만든다.
11. `local_web_recording` / `local_file_upload` adapter가 `VoiceSessionDraft`를 만든다.
12. 녹음 파일을 `{storageDir}/sessions/{sessionId}/source/audio.original.m4a`에 저장한다.
13. 로컬 STT adapter를 붙인다.
14. 전사 결과를 `transcript.raw.md`로 저장한다.
15. EXAONE local postprocessor를 붙인다.
16. `exaone.local-output.json`과 `agent-input.local.json`을 만든다.
17. Review 화면에서 민감정보 마스킹/외부 전달 여부를 확인한다.
18. 승인된 경우에만 `miso-payload.redacted.json`을 생성한다.
19. MISO 전달은 API, 복사/붙여넣기, workflow 입력 중 가능한 경로로 붙인다.
20. 위 두 입력이 완성된 뒤 iPhone Safari/PWA adapter를 추가한다.
21. 최종적으로 ixiO app adapter를 추가할 수 있게 source/type 계약을 유지한다.
22. 네이티브 iOS 앱/TestFlight는 이번 제출 범위에서 제외한다.

## 10. 데모 시나리오

### Private Demo

```text
1. Mac 로컬 웹앱 접속
2. "회의 녹음 시작" 또는 파일 업로드
3. 1분짜리 샘플 회의 발화
4. Mac이 로컬 STT 실행
5. EXAONE이 요약/액션/리스크/MISO payload 생성
6. 사용자가 민감정보 마스킹 확인
7. redacted MISO payload만 외부 전달
```

발표 포인트:

> 원본 음성, 전사문, EXAONE 후처리는 모두 사용자의 Mac 또는 개인 서버 안에서 끝납니다. 외부 워크플로우에는 사람이 승인한 구조화 결과만 전달됩니다.

### Channel Talk+n8n Demo

```text
1. Channel Talk 전화/Meet 전사문을 n8n에서 조회
2. live 연결이 어려우면 n8n sample payload를 사용
3. n8n HTTP Request가 /api/ingest/channel-talk 호출
4. channel_talk_n8n adapter가 VoiceSessionDraft를 만든다
5. source/channel-talk.payload.json과 source/channel-transcript.raw.md 저장
6. EXAONE이 요약/액션/리스크/MISO payload 생성
7. 사용자가 redacted payload를 확인
```

발표 포인트:

> 보안형 Private Mode는 Mac 로컬 입력으로 보여주고, 업무 시스템 Integration Mode는 Channel Talk+n8n 입력으로 보여줍니다. 둘 다 같은 agent-ready format으로 정리되기 때문에 MISO 같은 워크플로우는 입력 채널을 신경 쓰지 않고 실행할 수 있습니다.

### n8n-first Development Demo

개발 초반에는 EXAONE pipeline이 아직 완성되지 않아도 아래 장면을 먼저 볼 수 있어야 한다.

```text
1. 로컬 n8n workflow 수동 실행
2. sample Channel Talk payload POST
3. ixi-O Agent가 세션 폴더 생성
4. source/channel-talk.payload.json 저장
5. transcript/transcript.raw.md 저장
6. 세션 상태는 pending_processing
```

발표 포인트:

> ixi-O Agent는 처리 모델이 붙기 전에도 업무 음성 이벤트를 잃지 않고 쌓아둘 수 있습니다. 이후 로컬 EXAONE 처리기가 준비되면 쌓인 세션을 같은 계약으로 후처리합니다.

### Expansion Demo

```text
1. 같은 pipeline에 iPhone Safari adapter 또는 ixiO adapter를 추가
2. adapter가 VoiceSessionDraft를 만든다
3. 이후 STT/EXAONE/Review/MISO payload는 그대로 재사용
```

발표 포인트:

> 이번 제출에서는 Mac 로컬 입력과 Channel Talk+n8n 입력을 데모에 보여주고, 입력부는 adapter로 분리했습니다. 그래서 iPhone Safari와 ixiO 앱 연동은 같은 파이프라인에 단계적으로 추가할 수 있습니다.

## 11. MISO 전달 원칙

MISO는 실행/워크플로우 레이어로 둔다. 문서상 외부 voice event를 MISO에 직접 push하는 표준 ingest webhook/API는 확인되지 않았다. 따라서 제출 MVP에서는 payload를 생성하고, 사람이 확인한 뒤 복사/다운로드 또는 `/ext/v1/chat` 실험으로 넘긴다.

기밀 보호형 구조에서는 아래 원칙을 지킨다.

- MISO에는 원본 음성을 보내지 않는다.
- 기본적으로 원문 전사문도 보내지 않는다.
- `summary`, `actionItems`, `urgency`, `requiredTeams`, `evidenceNeeded` 중심으로 보낸다.
- 사람 검토 없이 자동 전송하지 않는다.
- payload에는 `redactionApplied: true`, `sourceMode: "private_local"` 같은 메타데이터를 넣는다.
- MISO에는 `voice-session.created` 같은 inbound webhook/MCP schema가 필요하다고 제안한다.

예시:

```json
{
  "source": "ixi-o-agent-private-local-voice-bridge",
  "sourceMode": "private_local",
  "mode": "meeting",
  "title": "장애 보상 검토 회의",
  "summary": "고객 영향과 보상 기준을 검토해야 한다.",
  "urgency": "high",
  "requiredTeams": ["NOC", "고객 성공"],
  "actionItems": [
    {
      "text": "장애 시간대 로그와 SLA 기준을 확인한다.",
      "owner": "NOC",
      "status": "open"
    }
  ],
  "redactionApplied": true,
  "humanReviewRequired": true,
  "rawTranscriptIncluded": false,
  "rawAudioIncluded": false
}
```

## 12. 발표 메시지

짧은 버전:

> ixi-O Agent는 일상의 모든 음성을 에이전트가 이해할 수 있는 업무 입력으로 바꾸는 로컬 Voice Bridge입니다. 음성 파일, 전사문, EXAONE 후처리는 사용자의 Mac 또는 개인 서버에서 처리되고, 외부 워크플로우에는 사람이 승인한 결과만 전달됩니다.

LG U+ 트랙 버전:

> 우리는 Voice AI를 클라우드 STT 호출로만 보지 않았습니다. 민감한 통화와 회의가 실제 업무 에이전트로 이어지려면 로컬 처리와 승인 게이트가 필요합니다. ixi-O Agent는 로컬 STT와 EXAONE 후처리로 음성을 구조화하고, MISO 같은 워크플로우에는 안전하게 정리된 payload만 전달합니다.

## 13. 지금 열어둘 결정

- Mac mini M4와 M1 MacBook 중 발표 현장 메인 처리기를 무엇으로 둘지
- STT 기본 모델을 `whisper.cpp small`로 할지 `mlx-whisper small`로 할지
- Phase 1 입력을 녹음 중심으로 할지, 파일 업로드 fallback을 먼저 둘지
- iPhone Safari/PWA와 Mac 로컬 화면을 같은 웹앱으로 만들지, 모바일 전용 화면을 분리할지
- Phase 4 ixiO app adapter의 입력 계약을 transcript 우선으로 둘지 audio 우선으로 둘지
- MISO로 실제 API 전달을 할지, 데모에서는 payload 복사/붙여넣기로 갈지
- 민감정보 마스킹을 rule-based로 할지 EXAONE prompt로 할지

## 14. 결정된 사항

- Telegram voice bot은 이번 제출 범위에서 제외한다.
- 저장 폴더 위치는 사용자가 설정할 수 있게 한다.
- MVP 설정 UI는 최소화하고, 처음에는 `config/local.json` 또는 환경변수로 처리한다.
- 사용자가 직접 설정할 항목은 우선 `storageDir`만 연다.
- GitHub에는 코드/문서/mock data만 공개하고, 실제 음성/전사/키/모델 파일은 제외한다.
- 소개 문구는 "일상의 모든 Voice를, 에이전트와 함께"를 기준으로 한다.
- ixiO 표현은 "ixi-O 통화와 연동하여 더 강력해져요"로 둔다.
- Channel Talk+n8n live 연결은 보너스로 두고, 기본은 n8n sample workflow로 보여준다.
