# Three Input MVP Scope

> 작성일: 2026-05-30 KST
> 목적: ixi-O Agent Private Voice Bridge의 입력 후보 3개를 정의하되, MVP에서는 1개 핵심 입력으로 전체 플로우를 완성하고 Channel Talk+n8n 입력을 데모에 노출
> 기준:
> - `current/private-local-voice-agent-architecture.md`
> - LG U+ Track: Voice AI + EXAONE 필수
> - 기밀/개인정보 시나리오는 로컬 처리 우선

---

## 1. 결론

구현할 입력 후보는 아래 3개로 제한한다. 단, 제출 MVP에서 세 가지를 처음부터 모두 구현하지 않는다. ixiO는 별도 구현 후보가 아니라 최종 연동 목표로 둔다.

개발 착수는 **Channel Talk 전화 내용을 n8n으로 가져와 저장하는 ingest 레이어**부터 한다. 사용자가 다른 기능을 구현하는 동안에도 전사문 payload가 쌓이게 하기 위해서다.

다만 제출 데모의 제품 메시지는 여전히 **MacBook M1/Mac mini M4 로컬 웹앱 입력**으로 로컬 STT/EXAONE end-to-end를 증명하는 것이다. n8n 입력은 같은 파이프라인에 들어오는 두 번째 입력으로 보여준다.

```text
Mac local web app
  -> record / file upload
  -> local STT
  -> local EXAONE
  -> review
  -> agent-input.local.json
  -> miso-payload.redacted.json
```

채널톡 데모 입력은 같은 후처리 파이프라인으로 들어간다.

```text
Channel Talk phone/meet
  -> n8n polling or webhook flow
  -> /api/ingest/channel-talk
  -> channel_talk_n8n adapter
  -> local EXAONE
  -> review
  -> agent-input.local.json
  -> miso-payload.redacted.json
```

실제 Channel Talk 권한/플랜/토큰이 준비되면 live n8n flow를 보여주고, 준비가 안 되면 동일 schema의 n8n sample payload를 흘려 데모한다. 그 다음 같은 입력 계약에 맞춰 iPhone Safari/PWA, 최종 ixiO 앱 연동을 순차 추가한다.

| 단계 | 입력/연동 | 목적 | 보안 등급 | MVP 판단 |
|---:|---|---|---|---|
| Phase 0 | n8n -> Channel Talk sample payload -> `/api/ingest/channel-talk` | 전사문을 먼저 쌓는 ingest 기반 | Integration | **개발 착수 1순위** |
| Phase 1 | MacBook M1/Mac mini M4 로컬 웹앱 | STT/요약/EXAONE 후처리까지 전부 로컬 처리 | Private | **제출 데모의 핵심 골든패스** |
| Phase 2 | Channel Talk 전화 내용을 n8n으로 가져오기 | 실제 상담/콜센터 연동 시나리오 | SaaS 경유 | **제출 데모에 포함. live 또는 n8n sample payload** |
| Phase 3 | iPhone Safari/PWA 버튼 녹음 | 모바일 캡처 경험 | Private LAN | MVP 후 확장. 같은 로컬 브릿지에 업로드 |
| Phase 4 | ixiO 앱 연동 | 원래 통화 앱/통신사 연동 목표 | TBD | 최종 확장 목표. 같은 adapter 계약으로 수용 |

제품 메시지는 이렇게 정리한다.

> ixi-O Agent는 개발 초기에 n8n ingest를 먼저 붙여 실제 업무 통화 전사문이 쌓이게 합니다. 발표에서는 Mac 로컬 입력으로 보안형 Voice AI 흐름을 증명하고, Channel Talk 전화 내용을 n8n으로 가져오는 입력을 함께 보여주어 같은 파이프라인이 실제 업무 통화 시스템에도 붙을 수 있음을 보여줍니다.

## 2. 공통 입력 계약

처음 구현하는 입력은 하나지만, 내부에서는 모든 입력을 같은 `VoiceInputAdapter` 계약으로 정규화한다.

```ts
type VoiceInputSource =
  | "local_web_recording"
  | "local_file_upload"
  | "iphone_safari_recording"
  | "channel_talk_n8n"
  | "ixio_app"
  | "sample_demo"

type VoiceInputAdapter = {
  source: VoiceInputSource
  receive(input: unknown): Promise<VoiceSessionDraft>
}

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

이 계약 덕분에 입력이 바뀌어도 이후 파이프라인은 그대로 둔다.

```text
VoiceInputAdapter
  -> VoiceSessionDraft
  -> STT if needed
  -> EXAONE post-processing
  -> Review Gate
  -> agent-input.local.json
  -> miso-payload.redacted.json
```

## 3. Phase 1: Mac 로컬 웹앱 입력

### 역할

핵심 보안 데모다. "음성/전사문/요약이 외부로 나가지 않는다"는 메시지를 먼저 완성한다.

```text
Mac local web app
  -> microphone recording or file drop
  -> local STT
  -> local EXAONE
  -> local agent-input.json
  -> human review
  -> redacted MISO payload
```

### 권장 런타임

Mac mini M4:

- 메인 처리 서버
- STT: `whisper.cpp small/medium` 또는 `mlx-whisper small/medium`
- EXAONE: `EXAONE-4.0-1.2B-GGUF Q4_K_M`
- 항상 켜진 로컬 브릿지로 사용

MacBook Air M1 기본형:

- 이동형/백업 처리기
- STT: `whisper.cpp base/small`
- EXAONE: `EXAONE-4.0-1.2B-GGUF Q4_K_M`
- STT와 EXAONE은 동시에 돌리지 말고 순차 처리

### 제출 MVP 구현

1. 로컬 웹앱에서 녹음 또는 파일 업로드를 받는다.
2. `{storageDir}/sessions/{sessionId}/source/audio.original.m4a`로 저장한다.
3. STT를 실행해 `transcript.raw.md`를 만든다.
4. EXAONE이 `exaone.local-output.json`을 만든다.
5. 사용자가 Review 화면에서 확인한다.
6. 승인된 경우에만 `miso-payload.redacted.json`을 만든다.

개발 순서상 n8n ingest가 먼저 만들어질 수 있다. 이 경우 Channel Talk transcript 세션은 `pending_processing` 상태로 저장해 두고, core pipeline이 준비되면 같은 계약으로 후처리한다.

## 4. Phase 2: Channel Talk 전화 -> n8n

### 역할

실제 비즈니스 콜센터/상담 시스템과 연결되는 입력이다. 이번 제출 데모에서는 Mac 로컬 앱으로 코어 파이프라인을 완성한 뒤, Channel Talk 전화 전사문이 n8n을 거쳐 같은 파이프라인으로 들어오는 장면까지 보여준다.

```text
Channel Talk phone/meet
  -> call log / meet message / STT messages / recording
  -> n8n Channel Talk node or HTTP Request
  -> POST /api/ingest/channel-talk
  -> channel_talk_n8n adapter
  -> source/channel-talk.payload.json
  -> source/channel-transcript.raw.md
  -> EXAONE post-processing
  -> review
  -> MISO payload
```

### 데모 기준

제출 데모에서는 아래 둘 중 하나를 택한다.

1. **Live path**
   - Channel Talk 토큰/플랜/통화 데이터가 준비된 경우
   - n8n이 Channel Talk call log 또는 meet STT messages를 가져온다.
   - n8n HTTP Request node가 ixi-O Agent local bridge의 `/api/ingest/channel-talk`로 payload를 보낸다.

2. **Demo-safe path**
   - live 권한이나 통화 데이터가 불안정한 경우
   - n8n에서 같은 schema의 sample payload를 만들어 `/api/ingest/channel-talk`로 보낸다.
   - 발표에서는 "실서비스에서는 Channel Talk node가 이 payload를 만든다"고 설명한다.

두 경우 모두 ixi-O Agent 내부에서는 `channel_talk_n8n` source의 `VoiceSessionDraft`로 정규화된다.

### 장점

- 실제 업무 시스템과 연결되는 느낌이 강하다.
- MISO 트랙의 workflow/platform 메시지와 잘 맞는다.
- 이미 채널톡에 존재하는 통화/상담 데이터를 후처리하는 구조라 B2B 시나리오가 명확하다.
- "Voice input이 여러 채널에서 와도 agent-ready format은 하나"라는 구조를 보여줄 수 있다.

### 보안 경계

이 입력은 Private Mode가 아니다.

- 통화/전사/녹음이 Channel Talk 인프라에 존재할 수 있다.
- n8n도 실행 위치에 따라 외부 서비스가 될 수 있다.
- 따라서 기밀 보호형 데모에서는 원본 음성을 새로 올리는 경로로 설명하지 않는다.
- 이 입력은 "이미 Channel Talk에 존재하는 업무 통화 기록을 에이전트 입력으로 정리하는 Integration Mode"로 설명한다.

### 제출 구현

1. `/api/ingest/channel-talk` endpoint를 만든다.
2. endpoint는 n8n normalized payload를 받아 `source/channel-talk.payload.json`로 저장한다.
3. transcript 배열을 병합해 `source/channel-transcript.raw.md`와 `transcript/transcript.raw.md`를 만든다.
4. `channel_talk_n8n` adapter가 `VoiceSessionDraft`를 만든다.
5. 이후 EXAONE/Review/MISO payload는 Phase 1 코드를 그대로 재사용한다.
6. live 연결이 불안정하면 n8n workflow가 `sample-data/channel-talk-normalized.json`과 같은 payload로 같은 endpoint를 호출한다.

실제 live path가 가능할 때의 n8n 작업:

1. n8n에서 Channel Talk call log 또는 user chat message를 조회한다.
2. meet message id를 찾는다.
3. STT messages를 가져온다.
4. transcript가 없으면 recording signed URL을 가져와 fallback STT를 실행한다.
5. ixi-O Agent `/api/ingest/channel-talk`가 `VoiceSessionDraft`로 정규화한다.

## 5. Phase 3: iPhone Safari/PWA 버튼 녹음

### 역할

사용자가 가장 이해하기 쉬운 모바일 캡처 경험이다. 24시간 제출 일정에서는 Apple Developer 계정, App Store Connect, TestFlight를 쓰지 않는다.

```text
iPhone Safari / PWA
  -> record button
  -> audio file
  -> local LAN upload to Mac bridge
  -> same VoiceInputAdapter contract
  -> Mac local STT
  -> Mac local EXAONE post-processing
  -> result review in browser
```

### MVP 이후 구현

iPhone은 `iphone_safari_recording` adapter만 추가한다. STT/EXAONE/Review/MISO payload는 Phase 1과 같은 코드를 사용한다.

```text
iphone_safari_recording
  -> VoiceSessionDraft
  -> existing local pipeline
```

### 왜 네이티브 iOS 앱을 제외하는가

Apple Developer 계정이 없는 상태에서 24시간 안에 TestFlight까지 안정적으로 진행하는 것은 제출 리스크가 크다.

필요한 작업:

- Apple Developer Program 가입과 결제
- App Store Connect 설정
- bundle id / signing / provisioning
- Xcode archive / upload
- TestFlight 테스터 설정
- 외부 테스트 시 Beta App Review 가능성 대응

따라서 이번 제출 범위에서는 "iPhone 앱"이라고 부르지 않고 "iPhone Safari/PWA 녹음 frontdoor"라고 부른다.

### iPhone 단독 로컬 처리

iPhone 로컬 STT는 가능성이 있다. Apple Speech framework 또는 whisper.cpp iOS를 쓸 수 있다.

iPhone 로컬 EXAONE은 기술적으로 가능성이 있지만, 제출 MVP에서는 제외한다. EXAONE 4.0 1.2B Q4 모델 파일, iOS 런타임, RAM/발열/초기 로딩 리스크가 크다.

## 6. Phase 4: ixiO 앱 연동

ixiO는 최종적으로 원래 목표인 통화 앱/통신사 연동 입력이다. 지금은 구현 대상이 아니지만, 구조상 `ixio_app` source만 추가하면 같은 pipeline에 들어오도록 둔다.

예상 입력:

```text
ixiO app / call transcript source
  -> transcript or call recording
  -> ixio_app adapter
  -> VoiceSessionDraft
  -> existing local pipeline
```

ixiO가 전사문을 제공하지 못하는 경우에도 같은 방식으로 녹음 파일을 받아 로컬 STT로 처리한다.

## 7. 데모 우선순위

1. **Mac local app**
   - 핵심 보안/기밀 메시지
   - STT + EXAONE 모두 로컬
   - 가장 안정적인 발표 경로
   - 제출 MVP의 core end-to-end 입력

2. **Channel Talk phone -> n8n -> ixi-O Agent**
   - B2B/콜센터 확장 시나리오
   - MISO workflow와 연결
   - Private Mode와는 별도 연동 모드로 설명
   - 제출 데모에서 n8n 입력 장면 또는 n8n sample payload를 보여준다

3. **iPhone Safari/PWA record -> Mac local bridge**
   - 사용자 경험을 보여주는 모바일 frontdoor
   - 실제 처리는 Mac에서 로컬로 수행
   - 네이티브 iOS 앱/TestFlight는 제출 범위에서 제외
   - core flow 완성 후 확장

4. **ixiO 앱 연동**
   - 최종 목표
   - 이번 제출에서는 설계상 열어둔다

## 8. 발표 메시지

> 우리는 먼저 Mac 로컬 웹앱 하나로 음성 입력부터 STT, EXAONE 후처리, 검토, MISO payload 생성까지 전체 흐름을 완성합니다. 그리고 Channel Talk 전화 전사문이 n8n을 통해 같은 파이프라인에 들어오는 장면을 보여줍니다. 입력은 adapter 구조로 분리해 두었기 때문에 이후 iPhone Safari, 최종적으로 ixiO 앱 연동까지 같은 파이프라인에 추가할 수 있습니다.

## 9. Sources

- Apple Speech framework `supportsOnDeviceRecognition`: https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition
- Apple Speech live audio recognition sample: https://developer.apple.com/documentation/Speech/recognizing-speech-in-live-audio
- whisper.cpp README: https://github.com/ggml-org/whisper.cpp
- EXAONE 4.0 1.2B GGUF: https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B-GGUF
- Channel Talk + n8n research: `current/channel-talk-n8n-ingest-research.md`
