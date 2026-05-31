---
# ixi-O Agent Memory MVP — 구현 에이전트 인계 프롬프트

당신은 ixi-O Agent Memory MVP를 구현하는 에이전트입니다. 사용자(팀장님)는 직접 코딩하지 않으며, 당신이 계획서에 따라 코드를 작성하고 테스트합니다.

---

## 프로젝트 개요

ixi-O(LG U+ AI 통화 서비스)의 통화 전사문을 에이전트가 읽을 수 있는 로컬 Markdown 메모리 파일로 자동 변환하고, MCP를 통해 Claude Desktop 같은 에이전트가 검색할 수 있게 해주는 브릿지입니다.

행사: OBA WEEKENDTHON, 2026-05-30(토) ~ 2026-05-31(일), 카카오 AI 캠퍼스

---

## 절대 경로

| 항목 | 경로 |
|---|---|
| 프로젝트 루트 (생성할 위치) | `/Users/bot_mandu/Documents/ixi-O Agent/ixi-o-agent-memory/` |
| 기준 문서 (MVP 설계) | `/Users/bot_mandu/Documents/ixi-O Agent/current/ixi-o-agent-memory-mvp.md` |
| 구현 계획서 | `/Users/bot_mandu/Documents/ixi-O Agent/current/ixi-o-mvp-implementation-plan.md` |
| 아카이브 (읽지 마세요) | `/Users/bot_mandu/Documents/ixi-O Agent/archive/` |

**중요**: 프로젝트 코드는 `/Users/bot_mandu/Documents/ixi-O Agent/ixi-o-agent-memory/` 아래에 생성하세요. `archive/` 폴더의 과거 리서치 문서는 참고하지 마세요.

---

## 반드시 먼저 읽을 파일

작업 시작 전에 아래 두 파일을 반드시 읽으세요:

1. `/Users/bot_mandu/Documents/ixi-O Agent/current/ixi-o-agent-memory-mvp.md` — 제품 설계, 스키마 정의, 저장 구조, MCP tool 명세, U+ API 대응 전략
2. `/Users/bot_mandu/Documents/ixi-O Agent/current/ixi-o-mvp-implementation-plan.md` — 구현 계획서 (이 프롬프트의 상세 버전)

---

## 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 기술 스택 | TS 권장 (MCP SDK + Vercel + OpenClaw 생태계 고려). 단, 사용자에게 확인 후 Python도 가능 |
| 개발 방식 | 사용자는 직접 코딩 안 함. 에이전트가 구현 |
| 텔레그램 | OpenClaw 에이전트 + ChatGPT 백엔드. 데모용 신규 봇 |
| 수정 기능 | 자연어로 MD 파일 직접 수정 (이름 오타, 날짜, 액션아이템 완료 처리) |
| 전문/요약 분기 | 텍스트 길이 기준 (구체적 글자 수는 구현 시 정함) |
| mock 데이터 | 한국어, 실명 사용 가능. 5개 시나리오 |
| ixi-O API | 블랙박스. webhook 수신 가정. 전사문 기본, 요약만 오면 전사문으로 취급 |
| 웹 UI | Vercel Hobby 배포 (프론트) + 로컬 API 서버 + ngrok 터널 |
| 저장소 | 로컬 파일시스템 (24시간 가동 PC). Markdown vault + JSONL 인덱스 |
| MCP 서버 | stdio 방식, Claude Desktop 연결 |
| 네트워크 실패 대응 | MVP에서 미고려 |

---

## 생성할 파일 구조

```
/Users/bot_mandu/Documents/ixi-O Agent/ixi-o-agent-memory/
├── providers/
│   ├── ixio.ts          # 빈 껍데기 (행사장에서 ixi-O API에 맞게 채움)
│   ├── mock.ts          # sample-data/*.json 로드
│   └── upload.ts        # 텍스트 붙여넣기/파일 업로드 입력
│
├── core/
│   ├── types.ts         # CallRecord, Participant, Utterance, MemoryAtom 타입
│   ├── normalizeCall.ts # provider 출력 → CallRecord 변환
│   ├── extractMemory.ts # LLM 호출 → summary, action items, memory atoms 추출
│   └── writeVault.ts    # CallRecord → MD 파일 + JSONL 인덱스 기록
│
├── mcp/
│   └── server.ts        # MCP 서버 (search_calls, read_call, get_open_loops)
│
├── openclaw/
│   └── call-memory-agent/
│       ├── agent.yaml        # OpenClaw 에이전트 설정 (텔레그램 채널, ChatGPT)
│       └── skills/
│           ├── notify-call.md    # 통화 저장 알림 스킬
│           └── edit-call.md      # 자연어 수정 스킬
│
├── api/
│   └── server.ts        # 로컬 API 서버 (Express/Fastify). ngrok으로 노출
│                         # GET /api/lookup?q=김민수 → 최근 통화 요약 반환
│                         # GET /api/call/:callId → 특정 통화 MD 반환
│
├── web/
│   ├── index.html        # 수신 컨텍스트 데모 UI (Vercel 배포)
│   └── vercel.json
│
├── sample-data/
│   ├── networking-call.json    # 한국어. OBA 행사에서 만난 개발자
│   ├── investor-call.json      # 초기 투자자와 사업 논의
│   ├── customer-call.json      # 고객 문의/불만
│   ├── team-sync-call.json     # 팀 내부 주간 싱크
│   └── vendor-call.json        # 외부 벤더 계약 협의
│
├── call-memory/                 # 런타임에 생성되는 vault (.gitignore)
│   ├── calls/
│   └── index/
│       ├── calls.jsonl
│       └── memory_atoms.jsonl
│
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 내부 표준 스키마 (types.ts)

```ts
type CallRecord = {
  callId: string
  source: "ixio" | "mock" | "upload"
  startedAt: string          // ISO 8601
  endedAt?: string
  participants: Participant[]
  transcript: Utterance[]
  summary?: string           // ixi-O 제공 요약 (있으면 MD에 별도 섹션으로 포함)
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

## Markdown 파일 포맷

각 통화는 아래 포맷으로 `call-memory/calls/YYYY-MM-DD_call_NNN.md`에 저장:

```markdown
---
schema_version: call-memory.v1
call_id: call_001
source: mock
started_at: 2026-05-30T14:10:00+09:00
counterparty: "김민수"
counterparty_phone: "010-1234-5678"
tags: [OBA, collaboration]
---

# Call with 김민수

## ixi-O Summary
> (ixi-O 원본 요약. 없으면 이 섹션 생략)

## Agent Memory
- 김민수는 MCP 기반 워크플로우에 관심이 있다.
- 행사 이후 데모를 같이 보기로 했다.

## Action Items
- [ ] GitHub repo 링크 보내기
- [ ] 행사 후 3일 안에 후속 미팅 잡기

## Summary
(LLM이 생성한 구조화된 요약)

## Transcript
### Speaker 1 (0:00)
...

## User Notes
(텔레그램에서 사용자가 추가/수정한 내용)
```

---

## JSONL 인덱스 포맷

### index/calls.jsonl
```jsonl
{"callId":"call_001","source":"mock","startedAt":"2026-05-30T14:10:00+09:00","counterparty":"김민수","counterpartyPhone":"010-1234-5678","summary":"OBA 행사에서 MCP 기반 에이전트 메모리 아이디어를 논의했다.","path":"calls/2026-05-30_call_001.md"}
```

### index/memory_atoms.jsonl
```jsonl
{"type":"preference","subject":"김민수","text":"MCP 기반 워크플로우에 관심이 있다.","sourceCallId":"call_001","confidence":0.86}
{"type":"commitment","subject":"user","text":"행사 후 3일 안에 후속 미팅을 잡기로 했다.","sourceCallId":"call_001","confidence":0.9}
```

---

## MCP 서버 (3개 tool)

```
search_calls(query?: string, limit?: number)
  → calls.jsonl에서 counterparty, summary, tags를 키워드 매칭 검색
  → 결과: callId, counterparty, startedAt, summary 목록

read_call(callId: string)
  → 해당 MD 파일 전문 반환

get_open_loops()
  → memory_atoms.jsonl에서 type="commitment"|"open_loop" 필터
  → calls/ MD 파일에서 미완료 체크박스("- [ ]") 수집
  → 합산 반환
```

stdio 방식으로 구현. Claude Desktop의 `claude_desktop_config.json`에 등록할 수 있어야 함.

---

## 로컬 API 서버 (웹 UI용)

`api/server.ts` — Express 또는 Fastify 기반.

```
GET /api/lookup?q={이름 또는 전화번호}
  → calls.jsonl에서 counterparty 또는 counterpartyPhone 매칭
  → 최근 통화 요약, action items, 마지막 통화 일시 반환

GET /api/call/:callId
  → 특정 통화 MD 파일 전문 반환

GET /api/open-loops
  → 미완료 action items 전체 반환
```

CORS 허용 (Vercel에서 호출하므로). 이 서버를 ngrok으로 노출:
```bash
ngrok http 3001
```

---

## 웹 UI (Vercel 배포)

`web/index.html` — 단일 페이지.

- 상단: 전화번호 또는 이름 입력 필드
- 입력 시 로컬 API (ngrok URL)에 `/api/lookup?q=...` 요청
- 결과: 최근 통화 요약, action items, 마지막 통화 일시를 카드 형태로 표시
- ngrok URL은 환경변수 또는 config로 주입

Vercel Hobby 플랜 사용. `vercel.json`으로 라우팅 설정.

---

## OpenClaw 텔레그램 에이전트

사용자는 이미 OpenClaw를 사용 중. 에이전트만 추가하면 됨.

### 에이전트 동작:
1. **알림**: 파이프라인에서 MD 저장 완료 시 트리거. 텍스트 길이 기준으로 전문/요약 분기하여 텔레그램 DM으로 발송.
2. **자연어 수정**: 사용자가 텔레그램에서 답장하면 ChatGPT가 의도를 파악하고 MD 파일을 직접 수정.
   - "김민수를 김민호로 바꿔줘" → 전체 파일에서 치환
   - "두 번째 액션 아이템 날짜를 6/5로" → 해당 줄 수정
   - "세 번째 액션 완료 처리해줘" → `- [ ]` → `- [x]`
3. **완료 확인**: 수정 후 "수정 완료: 김민수 → 김민호로 변경했습니다." 메시지 발송

### OpenClaw 스킬 파일 작성:
- `openclaw/call-memory-agent/skills/notify-call.md` — 알림 트리거 + 전문/요약 분기 로직
- `openclaw/call-memory-agent/skills/edit-call.md` — MD 파일 읽기 + 수정 + 저장 + JSONL 인덱스 업데이트

에이전트 설정은 OpenClaw docs(https://docs.openclaw.ai/) 참조. 텔레그램 채널은 grammY 기반, ChatGPT 백엔드.

---

## mock transcript 시나리오 (한국어, 5개)

각 파일은 `sample-data/`에 JSON으로 저장. CallRecord 스키마와 호환되는 구조로 작성.

| # | 파일명 | 시나리오 | 참여자 |
|---|---|---|---|
| 1 | networking-call.json | OBA 행사에서 만난 개발자와 후속 미팅 약속 | 사용자 + 김민수 |
| 2 | investor-call.json | 초기 투자자와 사업 방향 논의 | 사용자 + 박지영 |
| 3 | customer-call.json | 고객 서비스 문의/불만 접수 | 사용자 + 이준호 |
| 4 | team-sync-call.json | 팀 내부 주간 싱크 | 사용자 + 최서연 + 정도현 |
| 5 | vendor-call.json | 외부 벤더와 계약 조건 협의 | 사용자 + 한유진 |

각 mock transcript는 최소 8~15 utterance, 자연스러운 한국어 대화, action items와 약속이 대화 안에 자연스럽게 포함되도록 작성.

---

## 데이터 흐름 요약

```
입력 (ixi-O webhook / mock / upload)
  → providers/* (어댑터)
  → normalizeCall → CallRecord
  → extractMemory (LLM) → summary + action items + memory atoms
  → writeVault → MD 파일 + JSONL 인덱스 (로컬 저장)
  → OpenClaw 에이전트 → 텔레그램 알림 + 자연어 수정
  → MCP 서버 → Claude Desktop 질의 응답
  → 로컬 API + ngrok → Vercel 웹 UI → 수신 컨텍스트 표시
```

---

## 구현 순서 (Phase별)

### Phase 1: 코어 파이프라인 (최우선)
1. `core/types.ts` 타입 정의
2. `sample-data/` mock 5개 작성
3. `providers/mock.ts` 구현
4. `providers/upload.ts` 구현
5. `core/normalizeCall.ts` 구현
6. `core/extractMemory.ts` 구현 (LLM 프롬프트 포함)
7. `core/writeVault.ts` 구현
8. end-to-end 테스트: `mock → CallRecord → MD + JSONL` 확인

### Phase 2: MCP 서버
1. `mcp/server.ts` — 3개 tool 구현
2. Claude Desktop `claude_desktop_config.json`에 등록
3. 데모 질문 3개 테스트: "오늘 후속 연락할 사람?", "MCP 관심 보인 사람?", "내가 약속한 일 정리해줘"

### Phase 3: OpenClaw 텔레그램 에이전트
1. BotFather에서 데모용 봇 생성
2. `openclaw/call-memory-agent/` 스킬 작성
3. 알림 발송 테스트
4. 자연어 수정 테스트
5. action item 완료 처리 테스트

### Phase 4: 웹 UI + 로컬 API
1. `api/server.ts` 로컬 API 서버 구현
2. ngrok 연결 테스트
3. `web/index.html` 수신 컨텍스트 UI 구현
4. Vercel 배포
5. 외부 네트워크에서 접근 테스트

### Phase 5: 행사장 대응 (행사 중)
1. U+ ixi-O API 형태 파악
2. `providers/ixio.ts` 구현
3. 실제 통화 데이터로 end-to-end 테스트

---

## 주의사항

- `archive/` 폴더의 과거 리서치 문서는 아카이브이므로 읽지 마세요.
- U+ ixi-O API는 블랙박스로 가정하세요. `providers/ixio.ts`는 빈 껍데기로 두세요.
- API 키, 시크릿은 코드에 하드코딩하지 마세요. 환경변수로 관리하세요.
- mock 데이터는 한국어로 작성하고, 자연스러운 대화체로 만드세요.
- ixi-O가 요약만 제공할 경우, 요약 텍스트를 transcript 단일 utterance로 취급하는 fallback을 구현하세요.
- 각 Phase 완료 시 사용자에게 확인을 받으세요. 다음 Phase로 넘어가기 전에 테스트 결과를 보여주세요.

---

## 사용 가능한 도구/구독

- Claude 구독 (API 호출 가능)
- ChatGPT 구독 (OpenClaw 백엔드용)
- OpenClaw (이미 설치/운영 중, 에이전트만 추가)
- Vercel Hobby 플랜
- ngrok (무료 티어)
- 24시간 가동 로컬 PC (macOS)
