# Architecture Decisions

> 작성일: 2026-05-30 KST
> 목적: 제출 전 구현 방향 결정을 한 곳에 고정
> 기준:
> - `current/three-input-mvp-scope.md`
> - `current/private-local-voice-agent-architecture.md`

---

## 1. 입력 전략

이번 제출에서는 입력을 여러 개 모두 완성하려 하지 않는다. 다만 Channel Talk 전화 내용을 n8n으로 가져오는 입력은 데모에서 보이는 두 번째 입력으로 포함한다.

개발 착수 순서:

1. **n8n -> `/api/ingest/channel-talk` -> 세션 저장**부터 구현
2. n8n sample workflow로 전사문 payload를 쌓는다
3. Channel Talk webhook realtime workflow를 붙인다
4. Channel Talk polling backup workflow를 붙인다
5. manual historical backfill workflow를 붙인다
6. Mac 로컬 웹앱 입력과 STT/EXAONE 골든패스를 붙인다
7. iPhone Safari/PWA 입력 추가
8. 최종적으로 ixiO 앱 연동

제품/발표 우선순위는 별도다. 해커톤 발표의 핵심 메시지는 여전히 **Mac 로컬 STT + 로컬 EXAONE + Review Gate**다. 다만 실제 개발에서는 사용자가 다른 기능을 만드는 동안 Channel Talk 전사문이 먼저 쌓이도록 n8n ingest를 앞당긴다.

Channel Talk+n8n은 Integration Mode다. live Channel Talk 권한/플랜/토큰이 준비되면 `webhook-first`로 실시간 수집하고, 누락/중단에 대비해 `polling backup`을 둔다. 빌딩/테스트 중에는 `manual historical backfill` workflow로 과거 내역도 다시 가져온다. 불안정하면 동일 schema의 n8n sample payload가 `/api/ingest/channel-talk`를 호출하도록 한다.

n8n은 이번 구현에서 선택 사항이 아니라 **기본 자동화 허브**로 둔다. Channel Talk 입력도 n8n을 통해 들어오고, 이후 Slack/Email/MISO 실험/ixiO adapter 같은 추가 작업도 n8n workflow를 통해 같은 ingest 계약에 연결한다.

Telegram voice bot은 이번 제출 MVP에서 제외한다. 나중에 편의 입력 adapter로 추가할 수 있지만, 보안형 핵심 데모에는 포함하지 않는다.

## 2. Repository Structure

약식 monorepo로 간다. 입력 adapter를 늘려갈 계획이 있으므로 `apps/`와 `packages/`를 나눈다.

```text
ixi-O Agent/
  apps/
    local-web/
      src/
        app/
        api/
        components/
      public/
      package.json

  packages/
    core/
      src/
        schema/
        pipeline/
        review/
    adapters/
      src/
        local-web/
        iphone-safari/
        channel-talk/
        ixio/
    storage/
      src/
        session-store.ts
        config.ts
    stt/
      src/
        whisper-runner.ts
    exaone/
      src/
        postprocessor.ts
        prompts/

  docs/
    architecture/
    demo/
    n8n/
    proposed-miso-interfaces/

  n8n/
    workflows/
      channel-talk-sample-ingest.json
      channel-talk-webhook-ingest.json
      channel-talk-polling-ingest.json
      channel-talk-manual-backfill.json

  config/
    default.json
    local.example.json

  private-voice-inbox/
    .gitkeep
```

원칙:

- `private-voice-inbox/`는 런타임 데이터 폴더이며 git에 올리지 않는다.
- `config/local.json`, `.env`, 음성 샘플, 전사 원문, 모델 파일은 git에 올리지 않는다.
- 모델 파일은 repo 밖에 둔다.

## 3. User Settings

사용자가 직접 설정할 항목은 처음에는 **저장 폴더 위치만** 연다.

MVP 설정 방식:

1. `config/local.json`
2. 없으면 환경변수 `IXI_O_AGENT_STORAGE_DIR`
3. 둘 다 없으면 기본값 `./private-voice-inbox`

예시:

```json
{
  "storageDir": "/Users/you/PhoneClaw/private-voice-inbox"
}
```

나중에 UI Settings 화면을 추가한다. 단, 제출 MVP에서는 설정 파일 중심으로 간다.

추후 설정 후보:

- STT 모델 선택
- EXAONE 모델 경로
- MISO handoff 방식
- 민감정보 마스킹 on/off
- Channel Talk/n8n endpoint
- n8n base URL / workflow mode
- ixiO adapter endpoint

## 4. Local Storage Model

사용자가 제안한 것처럼 저장은 두 층으로 나눈다.

1. **Source artifacts**
   - 각 채널에서 넘어온 원본 자료
   - 음성 파일, 원본 전사문, Channel Talk payload, ixiO payload 등
   - 사람이 원본을 확인할 수 있게 보존

2. **Agent-ready artifacts**
   - 에이전트가 읽기 쉬운 구조화 결과
   - 할 일, 상대방 번호, 결정사항, 열린 질문, 긴급도, 필요한 팀/도구 등
   - MISO나 MCP로 넘기기 쉬운 JSON/Markdown

세션 폴더 구조:

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

### Source Artifacts

채널별 원본은 최대한 있는 그대로 저장한다.

예:

- `source/audio.original.m4a`
- `source/channel-talk.payload.json`
- `source/ixio.payload.json`
- `source/channel-transcript.raw.md`

### Agent-Ready Artifacts

에이전트가 읽는 파일은 원본과 분리한다.

예:

```json
{
  "sessionId": "2026-05-30_173012_meeting_demo",
  "mode": "call",
  "source": "local_web_recording",
  "counterparty": {
    "name": "김민수",
    "phone": "010-1234-5678",
    "organization": "고객사 A"
  },
  "summary": "장애 보상 기준과 후속 확인 사항을 논의했다.",
  "actionItems": [
    {
      "text": "장애 시간대 로그를 확인한다.",
      "owner": "NOC",
      "status": "open"
    }
  ],
  "decisions": [],
  "openQuestions": [],
  "urgency": "high",
  "sourceTranscriptPath": "transcript/transcript.cleaned.md"
}
```

## 5. MISO Handoff Positioning

MISO에 외부 업무 이벤트나 통화 전사 payload를 직접 push해서 케이스/워크플로우를 시작하는 표준 ingest webhook/API는 문서상 확인되지 않았다.

확인된 경로:

- MISO 앱이 외부 API/MCP를 도구로 호출할 수 있다.
- 발행된 MISO 앱은 `/ext/v1/chat` 같은 endpoint로 외부에서 호출할 수 있다.

따라서 제출 MVP는 다음 방식으로 간다.

- 제출 MVP에서는 `miso-payload.redacted.json` 생성과 복사/붙여넣기 가능한 화면을 제공한다.
- 시간이 되면 `/ext/v1/chat` 호출을 실험한다.
- 발표에서는 "외부 voice event를 받아 workflow를 시작하는 inbound trigger/API가 있으면 이 구조가 바로 붙는다"는 제안 형태로 설명한다.

즉, 우리는 MISO를 대체하지 않는다. ixi-O Agent는 **Voice input -> structured handoff payload**를 만드는 입력/정리 레이어이고, MISO에는 이 payload를 받아 실행할 inbound workflow 기능을 제안한다.

## 6. GitHub 공개 범위

제출 GitHub는 코드와 문서 중심으로 공개한다.

공개:

- 앱 코드
- adapter 인터페이스
- 샘플 데이터
- README / 소개 페이지
- proposed MISO interface 문서

비공개 또는 제외:

- 실제 음성 파일
- 실제 전사문
- 개인정보/전화번호가 들어간 데이터
- API 키, 토큰, `.env`, `config/local.json`
- 모델 파일

## 7. 소개 페이지 메시지

메인 문구:

> 일상의 모든 Voice를, 에이전트와 함께

보조 문구:

> ixi-O Agent는 회의와 통화 같은 일상의 음성을 로컬에서 전사하고, EXAONE으로 에이전트가 읽기 쉬운 업무 입력으로 바꿉니다.

ixiO 표현:

> ixi-O 통화와 연동하여 더 강력해져요

주의:

- 이번 제출에서 ixiO 실제 연동을 했다고 표현하지 않는다.
- "ixiO adapter 구조를 열어두었다"는 식으로 말한다.
- 위 문구는 future integration 영역에서만 사용하고, 구현 완료 항목처럼 배치하지 않는다.

## 8. Open Questions

- 로컬 n8n 실행을 Docker로 할지, npm/desktop으로 할지
- Channel Talk live API에서 meet root message를 찾는 기준을 call log 우선으로 둘지, user chat message 우선으로 둘지
- Phase 1 Mac local 입력에서 녹음을 먼저 구현할지, 파일 업로드 fallback을 먼저 구현할지
- STT는 `whisper.cpp`와 `mlx-whisper` 중 무엇을 기본으로 둘지
- MISO payload는 실제 제출 화면에서 복사 버튼만 둘지, `/ext/v1/chat` 실험 상태와 제안 API schema까지 같이 보여줄지
