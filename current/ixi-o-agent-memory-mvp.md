# ixi-O Agent Memory MVP

> 작성일: 2026-05-28
> 기준: 과거 리서치 문서 제외. 현재 대화에서 새로 정한 내용만 반영.
> 행사: OBA WEEKENDTHON, 2026-05-30 ~ 2026-05-31, 카카오 AI 캠퍼스

---

## 1. 제품 한 줄

ixi-O 통화 전사문을 에이전트가 읽을 수 있는 로컬 Markdown 메모리 파일로 자동 변환하고, MCP를 통해 Claude/Cursor 같은 에이전트가 검색할 수 있게 해주는 브릿지.

---

## 2. 핵심 판단

### U+ API는 블랙박스로 둔다

행사장에서 LG U+가 어떤 형태의 OpenAPI를 제공할지 아직 모른다. 따라서 제품 코어는 U+ API에 직접 묶지 않고, 모든 입력을 내부 표준 객체인 `CallRecord`로 정규화한다.

### MVP 저장소는 하나로 간다

MVP에서는 저장 옵션을 여러 개 만들지 않는다. 기본 저장소는 **로컬 Markdown vault** 하나로 둔다.

이 선택으로 동시에 얻는 것:

- 로컬 파일 저장
- Obsidian 호환
- Claude Code/Cursor가 직접 읽을 수 있음
- MCP server가 파일을 resource로 노출하기 쉬움
- Google Drive/iCloud/Dropbox 폴더에 저장하면 동기화도 가능

Notion은 MVP가 아니라 stretch goal로 둔다.

---

## 3. MVP 범위

### Must Have

- 샘플 또는 ixi-O 입력을 `CallRecord`로 변환
- 통화별 Markdown 파일 생성
- `calls.jsonl`, `memory_atoms.jsonl` 색인 생성
- 전사문에서 장기 메모리 후보와 액션 아이템 추출
- MCP tool로 최근 통화, 열린 할 일, 메모리 검색 제공

### Nice To Have

- Notion database sync
- Google Drive API sync
- 사용자 수정/승인 UI
- 사람별 profile note 자동 생성
- 벡터 검색

---

## 4. 아키텍처

```text
ixi-O API / uploaded transcript / mock sample
  -> provider adapter
  -> normalize to CallRecord
  -> extract summary, action items, memory atoms
  -> write local Markdown vault
  -> update JSONL indexes
  -> MCP server reads vault
  -> agent answers with call references
```

추천 코드 구조:

```text
providers/
  ixio.ts
  mock.ts
  upload.ts

core/
  normalizeCall.ts
  extractMemory.ts
  writeVault.ts

mcp/
  server.ts

sample-data/
  networking-call.json
  investor-call.json
  customer-call.json
```

---

## 5. 내부 표준 스키마

```ts
type CallRecord = {
  callId: string
  source: "ixio" | "mock" | "upload"
  startedAt: string
  endedAt?: string
  participants: Participant[]
  transcript: Utterance[]
  summary?: string
}

type Participant = {
  id: string
  displayName?: string
  phoneNumber?: string
  role?: "user" | "counterparty" | "unknown"
}

type Utterance = {
  speaker: string
  startSec?: number
  endSec?: number
  text: string
}

type MemoryAtom = {
  type: "fact" | "preference" | "commitment" | "decision" | "open_loop" | "relationship_context"
  subject?: string
  text: string
  sourceCallId: string
  confidence?: number
}
```

---

## 6. 저장 구조

Canonical storage:

```text
call-memory/
  calls/
    2026-05-30_call_001.md
    2026-05-30_call_002.md
  people/
    kim-minsu.md
  index/
    calls.jsonl
    memory_atoms.jsonl
```

MVP에서는 `calls/`와 `index/`만 필수다. `people/`은 시간이 남으면 만든다.

---

## 7. 통화 Markdown 포맷

```markdown
---
schema_version: call-memory.v1
call_id: call_001
source: ixio
started_at: 2026-05-30T14:10:00+09:00
counterparty: "김민수"
tags:
  - OBA
  - collaboration
  - MCP
---

# Call with 김민수

## Agent Memory

- 김민수는 MCP 기반 워크플로우에 관심이 있다.
- 행사 이후 ixi-O API 기반 데모를 같이 보기로 했다.

## Action Items

- [ ] GitHub repo 링크 보내기
- [ ] 행사 후 3일 안에 후속 미팅 잡기

## Summary

OBA Weekendthon 현장에서 ixi-O 전사문을 에이전트 메모리로 변환하는 아이디어를 논의했다.

## Transcript

### Speaker 1
...

### Speaker 2
...
```

---

## 8. JSONL Index 포맷

### `index/calls.jsonl`

```jsonl
{"callId":"call_001","source":"ixio","startedAt":"2026-05-30T14:10:00+09:00","counterparty":"김민수","summary":"OBA Weekendthon 현장에서 ixi-O 전사문을 에이전트 메모리로 변환하는 아이디어를 논의했다.","path":"calls/2026-05-30_call_001.md"}
```

### `index/memory_atoms.jsonl`

```jsonl
{"type":"preference","subject":"김민수","text":"MCP 기반 워크플로우에 관심이 있다.","sourceCallId":"call_001","confidence":0.86}
{"type":"commitment","subject":"user","text":"행사 후 3일 안에 후속 미팅을 잡기로 했다.","sourceCallId":"call_001","confidence":0.9}
```

---

## 9. MCP Tools

MVP MCP tool은 3개면 충분하다.

| Tool | 역할 |
|---|---|
| `search_calls` | 통화 목록과 요약 검색 |
| `read_call` | 특정 통화 Markdown 읽기 |
| `get_open_loops` | 아직 닫히지 않은 action item과 open loop 반환 |

시간이 남으면 추가:

| Tool | 역할 |
|---|---|
| `search_memory` | memory atom 검색 |
| `list_people` | 사람별 통화/메모리 보기 |

---

## 10. U+ API 대응 전략

행사장에서 가능한 입력 수준을 3단계로 가정한다.

### 1순위: ixi-O transcript API 또는 webhook

가장 좋은 경우. 전사문, 통화 ID, 시간, 화자, 상대방 정보가 온다. 이 경우 `providers/ixio.ts`만 채우면 된다.

### 2순위: ixi-O 요약 또는 텍스트 export

전사문 전체가 없고 요약만 올 수 있다. 이 경우 summary를 transcript처럼 취급하고 memory atom extraction만 수행한다.

### 3순위: 수동 업로드 또는 붙여넣기

API가 제한적이어도 데모가 가능해야 한다. `providers/upload.ts` 또는 `providers/mock.ts`로 샘플 전사문을 받아 같은 파이프라인을 태운다.

---

## 11. 현장에서 U+에 물어볼 질문

- 통화 전사문을 가져오는 API가 있는가?
- 요약만 제공하는가, utterance 단위 전사문도 제공하는가?
- webhook이 있는가, polling만 가능한가?
- 통화 ID, 시작 시간, 종료 시간, 상대방 정보가 포함되는가?
- 화자 분리 데이터가 있는가?
- 전화번호나 이름은 마스킹되어 오는가?
- 사용자 인증/동의 방식은 무엇인가?
- 샌드박스 데이터가 제공되는가?
- 삭제 API가 있는가?
- 외부 LLM으로 전사문을 보내도 되는 약관/동의 조건이 있는가?

---

## 12. 데모 시나리오

### Magic Moment

통화가 끝난 뒤 몇 초 만에 `call-memory/`에 Markdown 파일이 생기고, Claude/Cursor가 다음 질문에 답한다.

### 데모 질문

- "오늘 내가 후속 연락해야 할 사람 누구야?"
- "MCP에 관심 보인 사람만 찾아줘."
- "내가 약속한 일만 정리해줘."

### 1분 피치 구조

1. ixi-O는 통화를 잘 기록하고 요약한다.
2. 하지만 에이전트는 앱 화면을 볼 수 없다.
3. 우리는 통화를 에이전트가 읽을 수 있는 memory file로 바꾼다.
4. 이제 통화는 사라지는 대화가 아니라 다음 작업의 context가 된다.

---

## 13. 행사 전 준비물

- [ ] mock transcript 5개 준비
- [ ] `CallRecord` 타입 확정
- [ ] local Markdown vault writer 구현
- [ ] `memory_atoms.jsonl` 생성 구현
- [ ] MCP server 최소 tool 3개 구현
- [ ] ixi-O adapter 빈 껍데기 준비
- [ ] 업로드/붙여넣기 fallback 준비
- [ ] 데모 질문 3개 고정
- [ ] 개인정보 없는 샘플 데이터만 사용

---

## 14. 결론

MVP는 "ixi-O 완전 연동"이 아니라 "ixi-O가 붙을 수 있는 agent memory bridge"다.

행사 전에는 아래 흐름을 완성해둔다.

```text
mock transcript
  -> CallRecord
  -> Markdown vault
  -> JSONL indexes
  -> MCP search
  -> agent answer
```

행사장에서는 U+ API 형태를 확인한 뒤 `providers/ixio.ts`만 실제 API에 맞게 교체한다.
