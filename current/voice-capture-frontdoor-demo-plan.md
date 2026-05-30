# Voice Capture Frontdoor Demo Plan

> 작성일: 2026-05-30
> 목적: 통화 전용 앞단을 회의/음성 메모까지 확장한 LG U+ + MISO 데모 방향 정리
> 기준:
> - LG U+ Track: Voice AI + EXAONE 필수
> - `current/ixi-o-agent-memory-mvp.md`
> - `current/miso-athena-callops-plan.md`
> - `contest-source-pack/research/EXAONE_LOCAL_FEASIBILITY.md`

---

## 1. 결론

앞단을 통화에만 고정하지 않고 **Voice Capture Frontdoor**로 확장한다.

한 줄 정의:

> 사용자가 통화나 회의 중 앱을 켜고 녹음을 시작하면, 로컬 Mac에서 전사와 EXAONE 후처리가 실행되고, 결과가 에이전트 입력 파일과 MISO 전달 payload로 저장된다.

이렇게 바꾸면 데모에서 실제 통화 연결을 만들 필요가 없다. 행사장에서는 회의/상담 상황을 말로 재현하거나 샘플 음성을 재생해도 같은 파이프라인을 보여줄 수 있다.

---

## 2. 제품 포지션

기존:

```text
ixi-O 통화 전사문
  -> CallRecord
  -> 로컬 메모리 / MCP / MISO
```

변경:

```text
통화 / 회의 / 음성 메모
  -> VoiceSession
  -> STT transcript
  -> EXAONE 후처리
  -> CallRecord 또는 MeetingRecord
  -> 로컬 메모리 / MCP / MISO
```

통화는 `VoiceSession`의 한 모드로 남긴다. 발표에서는 "통화와 회의를 모두 업무 컨텍스트로 변환하는 Voice AI frontdoor"라고 설명한다.

---

## 3. 데모 앞단 선택

### 1순위: 모바일 웹/PWA

가장 빠른 데모 경로다.

- iPhone Safari에서 접속
- 녹음 시작/일시정지/종료
- 녹음 파일을 Mac 로컬 브릿지로 업로드
- 로컬 Mac에서 STT + EXAONE 후처리
- 결과 화면에 요약/액션/MISO payload 표시

주의:

- 마이크 권한 때문에 HTTPS가 필요하다. ngrok 또는 Cloudflare Tunnel로 로컬 데모 서버를 HTTPS로 노출한다.
- iOS Safari의 `MediaRecorder`는 지원되지만 MIME 타입이 브라우저마다 다르다. WebM에 고정하지 말고 feature detection으로 `audio/mp4` 또는 지원 가능한 타입을 선택한다.
- 녹음 실패에 대비해 파일 업로드 fallback과 샘플 스크립트 재생 fallback을 둔다.

### 2순위: TestFlight 앱

발표 완성도는 좋지만 해커톤 MVP의 기본 경로로는 무겁다.

- Apple Developer 계정, Xcode 빌드, App Store Connect 설정이 필요하다.
- 내부 테스터 배포는 가능하지만 계정/빌드 설정 시간이 든다.
- 외부 테스터는 Beta App Review가 끼어 일정 리스크가 있다.

따라서 TestFlight는 시간이 남을 때의 포장 옵션으로 두고, 핵심 데모는 웹으로 만든다.

---

## 4. 모델 역할

EXAONE은 음성 인식 모델이 아니라 텍스트/이미지 중심 LLM/VLM이다. 따라서 음성 파일을 바로 EXAONE에 넣는 구조로 잡지 않는다.

권장 역할 분리:

```text
audio
  -> STT layer
  -> raw transcript
  -> EXAONE local postprocessor
  -> structured agent input
```

STT 후보:

- 데모 안정성 우선: 샘플 transcript fallback
- 로컬 우선: whisper.cpp 또는 mlx-whisper
- 브라우저 우선: Web Speech API는 iOS/Safari 편차가 있어 보조 수단으로만 사용

EXAONE 후보:

- 기본: EXAONE 4.0 1.2B GGUF Q4_K_M 로컬 실행
- 고품질 옵션: EXAONE 4.5 33B, 단 64GB+ Mac 또는 GPU/cloud 필요

사용자가 말한 `XR1`은 현재 계획에서는 EXAONE 로컬 후처리 런타임을 가리키는 임시 표현으로 보고, 발표/문서 표기는 `EXAONE`으로 통일한다.

---

## 5. 화면 구성

첫 화면은 설명 페이지가 아니라 바로 녹음 도구여야 한다.

필수 영역:

1. **Session Mode**
   - Meeting
   - Call
   - Voice Note

2. **Record Controls**
   - 녹음 시작
   - 일시정지
   - 종료
   - 샘플 데모 실행

3. **Live Status**
   - 녹음 시간
   - 입력 레벨
   - 업로드 상태
   - 로컬 처리 상태

4. **Transcript**
   - 원본 전사
   - 화자 분리 가능하면 표시
   - 수동 수정 가능

5. **EXAONE Output**
   - 요약
   - 결정사항
   - 액션 아이템
   - 열린 질문
   - 담당자/팀
   - MISO 전달 JSON

6. **Agent Handoff**
   - 생성된 파일 경로
   - MCP에서 읽을 수 있는 상태
   - MISO 전달 성공/실패

---

## 6. 파일 계약

녹음 1건은 아래 폴더로 저장한다.

```text
voice-inbox/
  2026-05-30_153012_meeting_demo/
    audio.m4a
    transcript.raw.md
    transcript.cleaned.md
    exaone-output.json
    agent-input.json
    miso-payload.json
```

`agent-input.json`은 기존 `CallRecord`를 확장한 형태로 둔다.

```ts
type VoiceSessionRecord = {
  sessionId: string
  source: "web_recording" | "mobile_upload" | "sample_audio" | "scripted_demo"
  mode: "call" | "meeting" | "voice_note"
  startedAt: string
  endedAt?: string
  participants: Participant[]
  transcript: Utterance[]
  summary?: string
  decisions?: string[]
  actionItems?: ActionItem[]
  openQuestions?: string[]
  tags?: string[]
  sourceAudioPath?: string
}

type ActionItem = {
  text: string
  owner?: string
  dueDate?: string
  status: "open" | "done" | "blocked"
}
```

기존 `CallRecord` 소비자는 `mode: "call"`만 보면 되고, MISO/에이전트 쪽은 `VoiceSessionRecord`를 그대로 받아도 된다.

---

## 7. MISO 연결

MISO에는 최종적으로 `miso-payload.json`을 넘긴다.

```json
{
  "source": "phone-claw-voice-frontdoor",
  "mode": "meeting",
  "title": "장애 보상 검토 회의",
  "summary": "...",
  "urgency": "high",
  "requiredTeams": ["NOC", "CDN 운영", "고객 성공"],
  "actionItems": [
    {
      "text": "전일 14:00-18:00 CDN 로그 확인",
      "owner": "NOC",
      "status": "open"
    }
  ],
  "humanReviewRequired": true,
  "evidenceNeeded": [
    "장애 시간대 로그",
    "SLA 보상 정책",
    "고객 영향도 자료"
  ]
}
```

MISO가 직접 webhook ingest를 제공하지 않으면:

- 데모 UI에서 payload 복사
- MISO 앱 API 호출
- 또는 MISO workflow 입력창에 붙여넣기

세 가지 중 가능한 경로를 사용한다.

---

## 8. 구현 순서

1. 웹 녹음 UI를 만든다.
2. iPhone Safari에서 HTTPS 접속/녹음/업로드를 확인한다.
3. 녹음 실패 시 파일 업로드 fallback을 붙인다.
4. 로컬 Mac API가 audio/transcript를 받아 `voice-inbox/`에 저장한다.
5. STT는 처음에는 scripted transcript fallback으로 시작하고, 시간이 남으면 whisper.cpp/MLX로 붙인다.
6. EXAONE 4.0 1.2B 로컬 서버를 붙여 `exaone-output.json`을 만든다.
7. 기존 Markdown vault writer에 `VoiceSessionRecord`를 연결한다.
8. MISO payload를 생성하고 데모 화면에 표시한다.

---

## 9. 발표 메시지

발표에서는 이렇게 말한다.

> 우리는 통화 앱 하나를 만드는 대신, 모든 음성 업무가 에이전트의 입력 파일로 바뀌는 앞문을 만들었습니다. 회의나 통화가 끝나는 순간 로컬 EXAONE이 내용을 정리하고, 사람이 검토할 수 있는 액션과 MISO 워크플로우 입력으로 변환합니다.

이 메시지가 LG U+ Track의 Voice AI 조건과 MISO Track의 업무 워크플로우 조건을 동시에 만족한다.
