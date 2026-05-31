# MISO Handoff Feasibility And Proposal

> 작성일: 2026-05-30 KST
> 목적: ixi-O Agent 결과물을 MISO에 어떻게 넘길지, 문서상 가능한 범위와 제안할 인터페이스를 정리
> 기준:
> - MISO builders guide
> - GS네오텍 MISO track 발표자료
> - `current/miso-athena-callops-plan.md`
> - 서브에이전트 조사 결과

---

## 1. 결론

문서상 MISO에 외부 업무 이벤트나 통화 전사 payload를 직접 push해서 케이스/워크플로우를 시작하는 표준 ingest webhook/API는 확인되지 않았다.

확인된 것은 두 가지다.

1. MISO 앱이 외부 API/MCP를 **도구로 호출**할 수 있다.
2. 발행된 MISO 앱은 `/ext/v1/chat` 같은 endpoint로 **외부에서 호출**할 수 있다.

따라서 제출 MVP handoff는 아래가 맞다.

```text
ixi-O Agent local pipeline
  -> miso-payload.redacted.json 생성
  -> 사용자 Review
  -> 복사 버튼 / 파일 다운로드
  -> 필요 시 /ext/v1/chat 호출 실험
  -> 발표에서는 inbound voice-event webhook/MCP schema 제안
```

## 2. Evidence

### MISO custom tools are outbound from MISO

`MISO_OBA_HACKATHON_BUILDERS_GUIDE.md`는 커스텀 도구를 "외부 REST API를 OpenAPI 스키마로 등록해 사용하는 도구"라고 설명한다.

Source: `contest-source-pack/raw/google-drive/MISO_OBA_HACKATHON_BUILDERS_GUIDE.md:70-98`

해석:

- 이것은 MISO 앱/에이전트가 외부 REST API를 호출하는 구조다.
- 외부 앱이 MISO로 업무 event를 push하는 ingest endpoint 설명은 아니다.

### MCP tools are also tools MISO can use

MISO guide의 MCP 도구 등록은 MCP server config를 등록한 뒤 MISO가 해당 MCP tools를 가져오는 흐름이다.

Source: `contest-source-pack/raw/google-drive/MISO_OBA_HACKATHON_BUILDERS_GUIDE.md:100-119`

해석:

- ixi-O Agent가 MCP server를 열면 MISO가 그 MCP tool/resource를 읽는 구조는 가능하다.
- 그러나 "외부 voice event를 MISO workflow 시작 이벤트로 push"하는 표준 interface는 아니다.

### Published apps can be called by API

MISO guide는 앱 발행 후 API 키를 발급받으면 `/ext/v1/chat` 같은 endpoint로 에이전트나 챗플로우를 외부 화면/테스트 스크립트에서 호출할 수 있다고 설명한다.

Source: `contest-source-pack/raw/google-drive/MISO_OBA_HACKATHON_BUILDERS_GUIDE.md:305-306`

해석:

- 시간이 있으면 `miso-payload.redacted.json`을 `/ext/v1/chat`으로 보내는 실험은 가능하다.
- 하지만 이것은 "published chat app 호출"에 가깝고, 케이스 생성/업무 이벤트 ingest 표준 API는 아니다.

### MISO track expects API/webhook/schema proposal

MISO track 발표자료는 "MISO has no public open API yet"이라고 명시하고, 미션을 "막히는 지점을 다음 인터페이스 후보로 바꾸기"로 제시한다.

Source: `contest-source-pack/raw/google-drive/miso-track-presentation-gs-neotech.pdf`

Relevant extracted lines:

- line 6: `MISO has no public open API yet.`
- lines 129-153: `MISO 앱을 만들고, 막히는 지점을 다음 인터페이스 후보로 바꾸세요` / `API · MCP · webhook · schema 제안`

### Existing plan already identifies this gap

기존 MISO plan도 통화 전사문 자동 전달 표준 webhook 부재를 gap으로 잡고 있다.

Source: `current/miso-athena-callops-plan.md:248-258`

## 3. MVP Handoff

MVP는 직접 전송보다 **검증 가능한 payload 생성**에 집중한다.

필수 산출물:

```text
handoff/
  miso-payload.redacted.json
  proposed-miso-request.json
```

화면 기능:

- redacted payload preview
- copy JSON button
- download JSON button
- "MISO inbound webhook proposal" section
- optional `/ext/v1/chat` experiment status

## 4. Proposed MISO Interface

ixi-O Agent가 제안할 interface:

```http
POST /miso/events/voice-session.created
Content-Type: application/json
Authorization: Bearer <token>
```

Payload:

```json
{
  "eventType": "voice-session.created",
  "source": "ixi-o-agent-private-local-voice-bridge",
  "sourceMode": "private_local",
  "sessionId": "2026-05-30_173012_meeting_demo",
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

MCP 대안:

```text
MISO calls ixi-O Agent MCP
  -> list_voice_sessions
  -> read_voice_session
  -> create_case_from_voice_session
```

이 방식은 MISO의 기존 MCP 도구 방향과 더 잘 맞는다. 단, MISO가 주도적으로 ixi-O Agent local MCP에 접근해야 하므로 네트워크/인증/로컬 접근 문제가 남는다.

## 5. How To Phrase

GitHub/소개 페이지:

> ixi-O Agent turns everyday voice into agent-ready work context. Raw audio and transcripts stay local; only user-approved, redacted payloads are prepared for external workflow tools.

MISO track:

> MISO works well as an enterprise agent runtime, but call transcript ingestion is not yet a first-class interface. Our demo generates the exact redacted payload MISO would need, and proposes an inbound webhook/MCP schema for future integration.

한국어 발표:

> 이번 데모에서는 MISO로 원본 음성이나 원문 전사문을 보내지 않습니다. 로컬에서 STT와 EXAONE 후처리를 끝낸 뒤, 사람이 승인한 요약/액션/긴급도 payload만 만들고, MISO에는 이런 voice event ingest 인터페이스가 필요하다는 구체적인 webhook/MCP schema를 제안합니다.
