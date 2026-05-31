# MISO Track Plan - ATHENA CallOps

> 작성일: 2026-05-30
> 목적: OBA WEEKENDTHON GS네오텍 MISO 트랙 제출 방향 정리
> 기준 문서:
> - `current/ixi-o-agent-memory-mvp.md`
> - `current/ixi-o-mvp-implementation-plan.md`

---

## 1. 결론

이번 트랙에서는 네 가지 예시 유즈케이스 중 **요청 접수·분류 에이전트**를 검증한다.

ixi-O Agent/ixi-O 기획은 통화 전사문을 에이전트가 읽을 수 있는 업무 메모리로 바꾸는 구조다. MISO 트랙에서는 이를 고객센터/컨택센터 업무에 맞춰 재해석한다.

한 줄 정의:

> ATHENA CallOps는 고객 통화 전사문을 읽고, 요청 유형·긴급도·후속 조치·승인 필요 여부를 분류한 뒤, MISO Document MCP 기반 SOP 근거와 함께 사람이 확인 가능한 다음 행동을 제안하는 업무 AI 에이전트다.

---

## 2. 선택한 유즈케이스

### 메인 유즈케이스

**요청 접수·분류 에이전트**

고객 통화 또는 상담 전사문을 입력으로 받아 다음을 구조화한다.

- 요청 유형: 장애, 환불, 기술지원, 영업문의, 계약, 기타
- 긴급도: 낮음, 보통, 높음, 즉시 대응
- 고객 감정/불만 강도
- 핵심 문제
- 이미 약속한 후속 조치
- 필요한 담당 부서
- 사람이 확인해야 하는 지점
- 다음 행동 제안

### 보조로 포함할 요소

**정책/SOP 실행 에이전트**

MISO Document MCP 서버로 정책/SOP 문서를 조회해, 분류 결과의 근거를 제공한다.

**승인·검토 오케스트레이션 에이전트**

환불, 보상, 장애 인정, 계약 변경처럼 책임 소재가 필요한 케이스는 자동 실행하지 않고 `human_review_required`로 표시한다.

---

## 3. 기존 ixi-O Agent 기획과의 연결

기존 기획의 핵심 흐름:

```text
ixi-O API / uploaded transcript / mock sample
  -> provider adapter
  -> normalize to CallRecord
  -> extract summary, action items, memory atoms
  -> write local Markdown vault
  -> MCP server reads vault
  -> agent answers with call references
```

MISO 트랙 버전:

```text
고객 통화 전사문
  -> ixi-O Agent CallRecord
  -> ATHENA request classifier
  -> MISO Document MCP로 SOP/정책 검색
  -> 다음 행동 / 승인 필요 여부 / 담당 부서 제안
  -> 제약 로그 기록
  -> MISO가 다음에 열어야 할 API/MCP/웹훅/스키마 제안
```

즉, ixi-O Agent는 **통화 입력 레이어**, ATHENA는 **업무 판단 레이어**, MISO는 **엔터프라이즈 워크플로우 런타임**으로 둔다.

---

## 4. 데모 시나리오

### 추천 시나리오: 장애 문의 + 보상 검토

고객이 고객센터에 전화해 다음과 같이 말한다.

```text
어제 오후부터 CDN 캐시가 이상해서 이미지 로딩이 계속 느렸습니다.
우리 쇼핑몰 행사 중이었고 주문 전환율도 떨어진 것 같습니다.
이게 GS네오텍 쪽 장애인지 확인해주시고, 보상 가능 여부도 알려주세요.
오늘 안에 담당자 답변이 필요합니다.
```

ATHENA CallOps는 다음을 출력한다.

```json
{
  "request_type": "incident_compensation_review",
  "urgency": "high",
  "customer_sentiment": "frustrated",
  "summary": "고객은 전일 CDN 캐시 이상으로 이미지 로딩 지연이 발생했고, 행사 중 매출 영향이 있었다고 주장한다.",
  "required_team": ["NOC", "CDN 운영", "고객 성공"],
  "sop_evidence": [
    "장애 영향도 확인 필요",
    "SLA/보상 정책 확인 필요",
    "운영 로그와 고객 주장 시간대 대조 필요"
  ],
  "next_actions": [
    "고객이 언급한 시간대의 CDN 로그 확인",
    "동일 시간대 장애 공지 또는 모니터링 알림 확인",
    "SLA 보상 정책 적용 여부를 매니저에게 검토 요청",
    "고객에게 1차 접수 및 확인 예정 시간을 회신"
  ],
  "human_review_required": true,
  "reason_for_review": "보상 가능 여부와 장애 책임 소재는 사람이 최종 판단해야 함"
}
```

---

## 5. 데모 화면 구성

최소 화면은 아래 6개 영역이면 충분하다.

1. **Transcript Input**
   - mock 고객 통화 전사문 선택 또는 붙여넣기

2. **Request Classification**
   - 요청 유형, 긴급도, 고객 감정, 담당 부서

3. **SOP Evidence**
   - MISO Document MCP로 찾은 관련 정책/절차 근거

4. **Next Action Proposal**
   - 상담사 또는 운영자가 바로 할 수 있는 다음 행동

5. **Human Review**
   - 승인 필요 여부
   - 승인권자/검토자
   - 자동 처리 불가 이유

6. **Interface Gap Log**
   - 구현 중 막힌 점
   - 다음에 MISO가 열어야 할 API/MCP/웹훅/스키마

---

## 6. 기존 파일 구조에 얹는 방식

기존 문서가 제안한 구현 루트는 다음이다.

```text
/Users/bot_mandu/Documents/ixi-O Agent/ixi-o-agent-memory/
```

MISO 트랙용 확장은 기존 구조를 유지하면서 아래 파일만 추가하는 방식이 좋다.

```text
ixi-o-agent-memory/
├── core/
│   ├── classifyRequest.ts        # CallRecord -> RequestClassification
│   ├── retrieveSopEvidence.ts    # MISO Document MCP 또는 mock SOP 검색
│   └── proposeNextActions.ts     # 분류 + SOP 근거 -> 다음 행동 제안
│
├── sample-data/
│   ├── support-outage-call.json
│   ├── refund-ambiguity-call.json
│   └── technical-support-call.json
│
├── sample-docs/
│   ├── cdn-incident-sop.md
│   ├── compensation-policy.md
│   └── escalation-policy.md
│
├── web/
│   └── athena-callops.html       # MISO 트랙 데모 UI
│
└── track-output/
    ├── interface-gap-log.md
    └── proposed-miso-interfaces.md
```

중요한 점:

- 기존 `CallRecord` 스키마는 유지한다.
- MISO 트랙용 결과는 `RequestClassification` 또는 `CaseAnalysis` 같은 파생 객체로 둔다.
- 실제 ixi-O API가 없어도 `sample-data/*.json`으로 데모 가능해야 한다.
- 실제 MISO MCP 연결이 제한되면 `sample-docs/*.md`를 mock 문서 MCP처럼 사용한다.

---

## 7. 추가 파생 스키마

기존 `CallRecord` 다음 단계에 붙일 스키마:

```ts
type RequestClassification = {
  caseId: string
  sourceCallId: string
  requestType:
    | "incident"
    | "compensation_review"
    | "technical_support"
    | "refund"
    | "sales"
    | "contract"
    | "other"
  urgency: "low" | "normal" | "high" | "critical"
  customerSentiment?: "neutral" | "confused" | "frustrated" | "angry"
  summary: string
  requiredTeams: string[]
  openQuestions: string[]
  humanReviewRequired: boolean
  reviewReason?: string
  nextActions: string[]
  sopEvidence: SopEvidence[]
}

type SopEvidence = {
  docId: string
  title: string
  excerpt: string
  relevanceReason: string
}
```

---

## 8. MISO 트랙 평가 기준 매핑

| 발표 기준 | 우리가 보여줄 것 |
|---|---|
| 사람이 직접 확인 가능한 업무용 AI 앱 | 통화 전사문 입력 후 분류/근거/액션/승인 필요 여부를 화면에 표시 |
| 현실적인 업무 시나리오 테스트 | CDN 장애 문의, 보상 검토, 기술지원 같은 컨택센터 케이스 |
| MCP 도구를 이용한 기능/제약 이해 | MISO Document MCP 또는 mock SOP 검색 결과를 근거로 사용 |
| 승인·검토·예외·책임 소재 처리 | 보상/장애 책임은 자동 결정하지 않고 human review로 넘김 |
| 단순 챗봇이 아닌 판단/질문정리/다음 행동 제안 | 요청 유형, 긴급도, 담당 부서, 다음 액션 자동 제안 |
| 다음 API/MCP/웹훅/스키마 제안 | `proposed-miso-interfaces.md`에 구체적 인터페이스 정의 |

---

## 9. 구현 중 남길 제약 로그 예시

아래는 실제 구현하면서 기록할 항목이다.

```markdown
## Gap 1. 통화 전사문 ingest 인터페이스 부재

- 상황: 고객 통화 전사문을 MISO 앱으로 자동 전달할 표준 webhook이 없다.
- 영향: 사용자가 전사문을 수동으로 붙여넣어야 한다.
- 제안: `POST /miso/events/call-transcript.created` 웹훅 또는 MCP resource ingest 기능 필요.

## Gap 2. 업무 케이스 생성/상태 변경 API 부재

- 상황: 분류 결과를 실제 티켓/케이스로 저장할 표준 실행 API가 없다.
- 영향: 에이전트가 판단은 하지만 업무 상태를 닫을 수 없다.
- 제안: `case.create`, `case.update_status`, `case.assign_team` MCP tool 필요.

## Gap 3. 승인 요청 스키마 부재

- 상황: 보상/환불처럼 사람이 판단해야 하는 케이스를 표준 형식으로 올릴 수 없다.
- 영향: human-in-the-loop가 데모 화면 안에서만 머문다.
- 제안: `approval.requested` event schema와 `approval.resolve` tool 필요.
```

---

## 10. MISO에 제안할 인터페이스

### 1. Call Transcript Ingest Webhook

```ts
type CallTranscriptCreatedEvent = {
  eventType: "call_transcript.created"
  callId: string
  occurredAt: string
  customer?: {
    name?: string
    phone?: string
    accountId?: string
  }
  transcript: {
    speaker: string
    text: string
    startSec?: number
    endSec?: number
  }[]
  source: "ixi-o" | "ixi-o-agent" | "upload" | "other"
}
```

### 2. Case Management MCP Tools

```text
case.create(input)
case.assign_team(caseId, team)
case.update_status(caseId, status)
case.add_note(caseId, note)
case.link_call(caseId, callId)
```

### 3. Human Review / Approval Schema

```ts
type ApprovalRequest = {
  approvalId: string
  caseId: string
  requestedByAgent: string
  decisionNeeded: string
  evidence: string[]
  options: {
    label: string
    risk: string
    recommended: boolean
  }[]
  deadline?: string
}
```

### 4. Action Result Webhook

```ts
type ActionResultEvent = {
  eventType: "action.completed" | "action.failed" | "approval.resolved"
  actionId: string
  caseId: string
  status: "success" | "failed" | "rejected" | "approved"
  resultSummary: string
  performedBy: "agent" | "human"
  occurredAt: string
}
```

---

## 11. 최종 발표 메시지

발표에서는 ixi-O Agent를 전면에 세우기보다, MISO 트랙 문제정의에 맞춰 이렇게 말한다.

> 우리는 고객센터 통화가 끝난 뒤 생기는 비정형 대화를, MISO 같은 엔터프라이즈 에이전트 런타임이 실행 가능한 업무 컨텍스트로 바꾸는 실험을 했습니다.
>
> 결과적으로 좋은 분류 앱을 만드는 것보다 더 중요한 사실을 확인했습니다. 실제 업무 에이전트에는 통화 전사문 ingest, 케이스 생성, 승인 요청, 액션 결과 회수 같은 표준 인터페이스가 필요합니다.

---

## 12. 바로 할 일

1. `support-outage-call.json` mock 통화 만들기
2. `cdn-incident-sop.md`, `compensation-policy.md`, `escalation-policy.md` mock SOP 만들기
3. `RequestClassification` 스키마 확정
4. 통화 전사문 -> 요청 분류 -> SOP 근거 -> 다음 행동 제안 파이프라인 만들기
5. 데모 화면에 `Interface Gap Log`를 반드시 포함
6. 최종 산출물로 `proposed-miso-interfaces.md` 작성
