---
# ixi-O Agent Memory MVP — 구현 계획서

> 작성일: 2026-05-29
> 행사: OBA WEEKENDTHON, 2026-05-30(토) ~ 2026-05-31(일), 카카오 AI 캠퍼스
> 기준 문서: `ixi-O Agent/current/ixi-o-agent-memory-mvp.md`
> 상태: v2 — 질문 기반 보강 반영

---

## Part A. 최종 제품 비전

사용자가 ixi-O로 통화를 마치면, 아무런 조작 없이 다음이 자동으로 일어난다.

1. **자동 변환 + 저장**: 통화 전사문이 에이전트용 Markdown 메모리 파일로 변환되어 로컬 PC에 저장된다. ixi-O가 제공하는 통화 요약도 MD 파일에 포함된다.

2. **텔레그램 알림 + 자연어 수정**: OpenClaw 에이전트가 텔레그램으로 알림을 보낸다. 짧으면 전문, 길면 요약. 사용자가 자연어로 수정 요청("김민수를 김민호로 바꿔줘", "세 번째 액션 아이템 날짜를 6/3으로")하면 ChatGPT 기반으로 MD 파일을 직접 수정한다.

3. **에이전트 질의**: Claude Desktop에서 MCP를 통해 "오늘 후속 연락할 사람?", "김민수가 지난주에 뭐라고 했지?" 같은 질문에 통화 메모리 기반으로 답한다.

4. **수신 시 컨텍스트**: 특정 번호로 전화가 오면, 그 사람과의 최근 대화 요약이 화면에 즉시 표시된다.

---

## Part B. 해커톤 MVP 범위

### 구현하는 것

| # | 기능 | 설명 |
|---|---|---|
| M1 | CallRecord 정규화 | mock/upload 전사문 → 내부 표준 객체 변환 |
| M2 | Markdown vault 생성 | CallRecord → 통화별 MD 파일 + ixi-O 요약 포함 |
| M3 | JSONL 인덱스 생성 | `calls.jsonl`, `memory_atoms.jsonl` 자동 생성 |
| M4 | 메모리 추출 | 전사문에서 summary, action items, memory atoms를 LLM으로 추출 |
| M5 | MCP 서버 (3 tools) | `search_calls`, `read_call`, `get_open_loops` |
| M6 | OpenClaw 텔레그램 에이전트 | 저장 완료 알림 + 자연어 수정 (ChatGPT 기반) |
| M7 | 수신 컨텍스트 웹 UI | Vercel 배포, 번호/이름 입력 → 최근 통화 요약 표시 |

### 구현하지 않는 것 (최종 제품용)

- ixi-O API 실제 연동 (행사장에서 API 형태 확인 후 `providers/ixio.ts`만 교체)
- Notion sync
- Google Drive / iCloud sync
- 벡터 검색
- 사람별 profile note 자동 생성
- 실제 전화 수신 시 자동 트리거 (MVP는 웹 UI에서 수동 입력)

---

## Part C. 기술 스택

| 항목 | 선택 | 비고 |
|---|---|---|
| 언어 | 미정 (TS 권장) | MCP SDK + Vercel + OpenClaw 생태계 고려 시 TS가 자연스러움 |
| 개발 도구 | Claude Code / OpenAI Codex | 직접 코딩 없이 에이전트가 구현 |
| MCP 서버 | `@modelcontextprotocol/sdk` (TS) 또는 `mcp` (Python) | stdio 방식, Claude Desktop 연결 |
| 메모리 추출 LLM | Claude API 또는 ChatGPT API | 구독 중인 서비스 활용 |
| 텔레그램 | OpenClaw 에이전트 (ChatGPT 백엔드) | 기존 OpenClaw 인프라에 에이전트 추가 |
| 웹 UI | Vercel (Hobby 플랜) 배포 | 행사장에서 접근 가능 |
| 저장소 | 로컬 파일시스템 (24시간 가동 PC) | Markdown vault + JSONL 인덱스 |

---

## Part D. 파일 구조

```
ixi-o-agent-memory/
├── providers/
│   ├── ixio.ts          # 빈 껍데기 (행사장에서 채움)
│   ├── mock.ts          # mock transcript 로드
│   └── upload.ts        # 텍스트 업로드/붙여넣기
│
├── core/
│   ├── types.ts         # CallRecord, Participant, Utterance, MemoryAtom
│   ├── normalizeCall.ts # provider 출력 → CallRecord 변환
│   ├── extractMemory.ts # LLM 호출 → summary, actions, atoms 추출
│   └── writeVault.ts    # CallRecord → MD 파일 + JSONL 인덱스 기록
│
├── mcp/
│   └── server.ts        # MCP 서버 (search_calls, read_call, get_open_loops)
│
├── openclaw/
│   └── call-memory-agent/  # OpenClaw 에이전트 설정
│       ├── agent.yaml      # 에이전트 정의 (텔레그램 채널, ChatGPT 백엔드)
│       └── skills/
│           ├── notify-call.md    # 통화 저장 알림 스킬
│           └── edit-call.md      # 자연어 수정 스킬
│
├── web/
│   ├── index.html          # 수신 컨텍스트 데모 UI
│   ├── api/
│   │   └── lookup.ts       # Vercel serverless: 번호→최근통화 조회
│   └── vercel.json
│
├── sample-data/
│   ├── networking-call.json    # 한국어, 실명
│   ├── investor-call.json
│   ├── customer-call.json
│   ├── team-sync-call.json
│   └── vendor-call.json
│
├── call-memory/                # 생성되는 vault (gitignore)
│   ├── calls/
│   └── index/
│       ├── calls.jsonl
│       └── memory_atoms.jsonl
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Part E. 데이터 흐름

```
[입력]
  mock JSON / 붙여넣기 텍스트 / (행사장) ixi-O webhook
    │
    ▼
[providers/*]
  입력 형태별 adapter → 통일된 raw 데이터
  ※ ixi-O가 요약만 주면 → 요약을 전사문으로 취급
    │
    ▼
[core/normalizeCall]
  → CallRecord 생성
    │
    ▼
[core/extractMemory]
  → LLM 호출 (Claude API 또는 ChatGPT API)
  → summary, action items, memory atoms 추출
    │
    ├──▶ [core/writeVault]
    │      → calls/YYYY-MM-DD_call_NNN.md 생성
    │      → index/calls.jsonl 추가
    │      → index/memory_atoms.jsonl 추가
    │
    ├──▶ [openclaw/call-memory-agent]
    │      → 텔레그램으로 알림 발송 (텍스트 길이 기준 전문/요약 분기)
    │      → 사용자 자연어 수정 요청 수신 → ChatGPT가 의도 파악 → MD 파일 수정
    │      → action item 완료 처리도 텔레그램에서 가능
    │
    └──▶ [mcp/server]
           → search_calls: 통화 목록/요약 검색
           → read_call: 특정 통화 MD 전문 읽기
           → get_open_loops: 미완료 action items 반환

[web/ → Vercel]
  → 번호/이름 입력 → API가 로컬 index/calls.jsonl 조회 → 최근 통화 요약 표시
  → 행사장 포함 어디서든 접근 가능
```

---

## Part F. 핵심 구현 상세

### F1. CallRecord → Markdown 변환 규칙

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
> (ixi-O가 제공한 원본 요약이 여기에 들어감. 없으면 이 섹션 생략)

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
### Speaker 2 (0:15)
...

## User Notes
(텔레그램에서 사용자가 추가한 메모/수정 이력)
```

### F2. OpenClaw 텔레그램 에이전트 플로우

```
[파이프라인에서 MD 저장 완료]
  │
  ▼
[OpenClaw 에이전트 트리거]
  │
  ├─ 텍스트 길이 기준 분기
  │   ├─ 짧음 → 전문 발송
  │   │    "📞 통화 메모리가 저장되었습니다.\n\n{Agent Memory + Action Items + Summary}\n\n수정할 내용이 있으면 답장해주세요."
  │   │
  │   └─ 김 → 요약만 발송
  │        "📞 통화 메모리가 저장되었습니다.\n\n{Summary}\n\nAction Items:\n{목록}\n\n전문 보기: /full call_001\n수정할 내용이 있으면 답장해주세요."
  │
  ▼
[사용자 자연어 답장]
  예: "김민수를 김민호로 바꿔줘"
  예: "두 번째 액션 아이템 날짜를 6월 5일로 수정해"
  예: "세 번째 액션 완료 처리해줘"
  │
  ▼
[OpenClaw → ChatGPT]
  → 현재 MD 파일 읽기
  → 사용자 요청 해석
  → MD 파일 수정 후 저장
  → JSONL 인덱스도 필요시 업데이트
  → "수정 완료: 김민수 → 김민호로 변경했습니다." 확인 메시지
```

### F3. 수신 컨텍스트 웹 UI (Vercel)

Vercel에 배포되는 단일 페이지 앱. 상단에 전화번호 또는 이름 입력 필드. 입력 시 Vercel serverless function이 로컬 PC의 `calls.jsonl`을 조회하여 해당 연락처의 최근 통화 요약, action items, 마지막 통화 일시를 카드 형태로 반환.

**Vercel ↔ 로컬 PC 연결**: 로컬 PC에서 간단한 API 서버(Express/Fastify)를 띄우고, ngrok으로 인터넷에 노출한다. Vercel 웹 UI는 이 ngrok URL을 호출하여 `calls.jsonl`과 MD 파일을 실시간 조회한다. 24시간 가동 PC이므로 항상 접근 가능.

구조: `[행사장 브라우저] → [Vercel 웹페이지] → [ngrok 터널] → [집 PC API 서버] → [call-memory/ 파일 읽기]`

### F4. MCP 서버 Tool 정의

```
search_calls(query?: string, limit?: number)
  → calls.jsonl에서 키워드 매칭 검색, 결과 반환

read_call(callId: string)
  → 해당 MD 파일 전문 반환

get_open_loops()
  → memory_atoms.jsonl에서 type="commitment"|"open_loop" 필터
  → calls/ MD 파일에서 미완료 체크박스("- [ ]") 수집
  → 합산 반환
```

---

## Part G. mock transcript 시나리오 (5개, 한국어)

| # | 파일명 | 시나리오 | 핵심 추출 대상 |
|---|---|---|---|
| 1 | networking-call.json | OBA 행사에서 만난 개발자와 후속 미팅 약속 | commitment, relationship_context |
| 2 | investor-call.json | 초기 투자자와 사업 방향 논의 | decision, fact |
| 3 | customer-call.json | 고객 서비스 문의/불만 접수 | open_loop, commitment |
| 4 | team-sync-call.json | 팀 내부 주간 싱크 | action items 다수, decision |
| 5 | vendor-call.json | 외부 벤더와 계약 조건 협의 | fact, commitment, preference |

---

## Part H. 행사 전 준비 체크리스트

### Phase 0: 프로젝트 셋업 (행사 전)
- [ ] 레포 생성 + 기본 구조 세팅
- [ ] 기술 스택 확정 (TS 권장, 개발 에이전트와 협의)
- [ ] `CallRecord`, `MemoryAtom` 타입 정의

### Phase 1: 코어 파이프라인 (행사 전)
- [ ] mock transcript 5개 작성 (한국어, 실명)
- [ ] `providers/mock.ts` — mock 데이터 로드
- [ ] `providers/upload.ts` — 텍스트 붙여넣기 입력
- [ ] `core/normalizeCall.ts` — CallRecord 변환
- [ ] `core/extractMemory.ts` — LLM으로 메모리 추출
- [ ] `core/writeVault.ts` — MD 파일 + JSONL 인덱스 생성
- [ ] end-to-end 테스트: mock → CallRecord → MD + JSONL 확인

### Phase 2: MCP 서버 (행사 전)
- [ ] `mcp/server.ts` — 3개 tool 구현
- [ ] Claude Desktop에서 연결 테스트
- [ ] 데모 질문 3개로 동작 확인

### Phase 3: OpenClaw 텔레그램 에이전트 (행사 전)
- [ ] 데모용 텔레그램 봇 생성 (BotFather)
- [ ] OpenClaw에 call-memory-agent 추가
- [ ] ChatGPT 백엔드 연결
- [ ] 저장 완료 → 알림 발송 테스트
- [ ] 자연어 수정 요청 → MD 파일 수정 테스트
- [ ] action item 완료 처리 테스트

### Phase 4: 웹 UI + Vercel + 로컬 API (행사 전)
- [ ] 로컬 API 서버 구현 (Express/Fastify, calls.jsonl + MD 파일 조회)
- [ ] ngrok 설치 + 로컬 API 외부 노출 테스트
- [ ] 수신 컨텍스트 웹 페이지 구현 (Vercel 배포)
- [ ] Vercel 웹 UI → ngrok URL → 로컬 API 연결 확인
- [ ] 행사장 네트워크(모바일 핫스팟 등)에서 접근 테스트

### Phase 5: 행사장 대응 (행사 중)
- [ ] U+ API 형태 확인 → 질문 목록 기반으로 파악
- [ ] `providers/ixio.ts` 실제 API에 맞게 구현
- [ ] ixi-O가 요약만 제공 시 → 요약을 전사문으로 취급하는 fallback 확인
- [ ] 실제 통화 데이터로 end-to-end 테스트

### Phase 6: 데모 준비
- [ ] 1분 피치 준비
- [ ] 데모 시나리오 리허설
- [ ] 개인정보 처리 확인 (실명 사용 시 동의 범위)

---

## Part I. 확정된 결정 사항

| 항목 | 결정 | 비고 |
|---|---|---|
| 개발 도구 | Claude Code / OpenAI Codex | 직접 코딩 없음 |
| 텔레그램 | OpenClaw 에이전트 + ChatGPT | 데모용 신규 봇, 수신자 1명 |
| 수정 방식 | 자연어 → LLM이 MD 직접 수정 | 이름 오타, 날짜 수정, 완료 처리 |
| 전문/요약 분기 | 텍스트 길이 기준 | 구체적 글자 수 미정 |
| mock 데이터 | 한국어, 실명 사용 | 5개 시나리오 |
| ixi-O 대응 | webhook 수신 가정, 전사문 기본 | 요약만 오면 전사문으로 취급 |
| 웹 UI | Vercel Hobby(프론트) + 로컬 API + ngrok(터널) | 실시간 데이터 조회, 행사장 접근 가능 |
| 저장 위치 | 로컬 PC (24시간 가동) | MVP 기본값 |
| 네트워크 실패 | 미고려 | 해커톤 MVP |

---

## Part J. 데모 시나리오

### Magic Moment
통화 종료 → 몇 초 후 텔레그램 알림 → 수정 요청 → 에이전트에게 질문 → 즉답 → 전화 수신 시 컨텍스트 표시

### 데모 순서
1. mock 통화 데이터 입력 (또는 행사장에서 실제 ixi-O 연동)
2. 텔레그램에 OpenClaw 에이전트 알림 도착 확인
3. "김민수를 김민호로 바꿔줘" → 수정 완료 확인
4. Claude Desktop에서 "오늘 후속 연락할 사람?" 질문 → MCP 기반 답변
5. 웹 UI에서 "김민호" 수신 시뮬레이션 → 최근 통화 요약 표시
6. "내가 약속한 일만 정리해줘" → open loops 반환

### 1분 피치
1. ixi-O는 통화를 잘 기록하고 요약한다.
2. 하지만 에이전트는 앱 화면을 볼 수 없다.
3. 우리는 통화를 에이전트가 읽을 수 있는 memory file로 바꾼다.
4. 전화가 오면, 그 사람과 나눴던 이야기가 즉시 보인다.
5. 이제 통화는 사라지는 대화가 아니라 다음 작업의 context가 된다.
