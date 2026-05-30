# Phone-Claw Agent Task Queue

Updated: 2026-05-31 KST

## Purpose

이 문서는 다음 에이전트가 와도 바로 이어서 큰 단위 작업을 수행할 수 있게 만드는 persistent task queue다. 작은 TODO를 흩뿌리지 않고, end-to-end 가치가 있는 작업 단위마다 목표, 수정 범위, 완료 조건, 검증 방법, 완료 증거를 함께 둔다.

## Operating Rules

- 작업 단위는 가능한 한 `입력 -> 저장 -> 처리 -> 검수 -> 전달/데모 증거`까지 이어지는 흐름으로 잡는다.
- 작업을 시작하기 전에 관련 문서와 코드 경로를 먼저 읽는다.
- `.env.local`, `private-voice-inbox/`, `n8n-data*/`, `models/`, 원본 전사문, API 키는 커밋하지 않는다.
- 완료 후에는 최소한 `git diff`, 관련 API smoke test, 문서 갱신 여부를 확인한다.
- 사람이 보기 전에도 결과를 신뢰할 수 있도록 완료 증거를 남긴다.
- 과도한 추상화보다 데모 안정성과 보안 경계가 우선이다.

## Current Baseline

구현됨:

- Channel Talk Open API backfill -> local voice session 저장
- n8n sample/webhook/polling/manual workflow 초안
- local dashboard와 session detail/review 화면
- EXAONE GGUF local processing 버튼과 fallback-local 처리
- 검수 전 MISO payload 차단, 검수 후 redacted payload 공개
- M1 MacBook 재현 셋업 문서
- Channel Talk UI webhook 등록 및 합성 live event 기반 realtime proof

현재 주요 리스크:

- Channel Talk webhook 생성 API가 문서대로 호출해도 서버 500을 반환하므로 생성은 UI 수동 단계로 남음
- Cloudflare quick tunnel URL은 재시작 시 바뀌므로 Channel Talk UI webhook URL도 갱신해야 함
- 제출용 화면/시연 캡처가 아직 정리되지 않음
- MISO 쪽은 직접 push가 아니라 제안 schema/API로 설명해야 함

## Review Checklist For Every Task

작업 완료 후 reviewer 또는 implementer가 아래를 확인한다.

- 보안: 키, raw transcript, raw audio, model file, n8n runtime data가 git diff에 없는가
- 로컬성: EXAONE/STT/전사 원문 처리가 외부 API로 새지 않는가
- MISO 경계: 검수 전에는 MISO API가 payload를 숨기는가
- 재현성: README 또는 docs 명령어가 실제 현재 구조와 맞는가
- 데모성: 발표에서 클릭하거나 보여줄 수 있는 증거가 남았는가
- fallback: Channel Talk live 또는 모델 다운로드가 없어도 샘플/fallback 흐름이 깨지지 않는가

## Queue

### T1. Channel Talk Realtime Proof

Status: `completed`

Goal:

Channel Talk UI에서 webhook을 수동 등록하고, 실제 user chat 또는 전화/Meet 이벤트가 n8n으로 들어와 Phone-Claw 세션으로 저장되는 것을 증명한다.

Scope:

- `docs/channel-talk-webhook.md`
- `docs/n8n/local-docker.md`
- `current/implementation-status.md`
- 필요 시 `n8n/workflows/channel-talk-webhook-ingest.json`
- 필요 시 `apps/local-web/src/app/api/ingest/channel-talk/openapi/route.ts`

Required steps:

1. 현재 Cloudflare quick tunnel URL이 살아 있는지 확인한다.
2. Channel Talk UI에서 `Settings > Webhook > Create new webhook`으로 등록한다.
3. 테스트 user chat/message/call 이벤트를 발생시킨다.
4. n8n execution 또는 Phone-Claw `/api/sessions`에서 신규 세션 여부를 확인한다.
5. webhook event만으로 전사문이 부족하면 polling/manual backfill로 보강되는 흐름을 확인한다.

Result:

- Channel Talk UI에서 `Phone-Claw n8n realtime` webhook 생성 완료.
- `GET /open/v5/webhooks`에서 channel `218885`, scopes `userChat.opened`, `message.created.userChat`, `blocked: false` 확인.
- 합성 Channel Talk member/userChat/message를 Open API로 만들고 실제 webhook 수신 확인.
- 실제 v5 이벤트는 `{ event, type, entity, refers }` 최상위 shape로 도착함을 확인.
- 파서를 수정해 `type: "message"` 최상위 이벤트에서 transcript를 추출하도록 함.
- 신규 proof session: `20260530T153141_utc_channel_talk_e7b435ae0b`, utterance count `1`.

Verification:

```bash
curl -sS -o /tmp/phone-claw-webhook-check.txt -w '%{http_code}\n' \
  -X POST -H 'Content-Type: application/json' \
  "$CHANNEL_TALK_WEBHOOK_URL" \
  -d '{"event":"healthcheck","source":"phone-claw"}'

set -a; source .env.local; set +a
pnpm backfill:channel-talk
curl -fsS http://localhost:3000/api/sessions
```

Completion evidence:

- 신규 세션 ID: `20260530T153141_utc_channel_talk_e7b435ae0b`
- n8n -> app route logs: `POST /api/ingest/channel-talk/openapi 200`
- `docs/channel-talk-webhook.md` and `current/implementation-status.md` updated

Adversarial review focus:

- webhook event가 raw payload만 저장하고 끝나는지, full message history를 가져오는 보강 경로가 있는지
- tunnel URL이 ephemeral임을 문서에 남겼는지
- 기존 pasted API key를 계속 쓰지 말고 최종 데모 전 rotation 필요성을 남겼는지

### T2. Demo Flow Hardening

Status: `ready`

Goal:

심사위원 앞에서 3분 안에 깨지지 않는 golden path를 만든다.

Scope:

- `apps/local-web/src/app/page.tsx`
- `apps/local-web/src/app/sessions/[sessionId]/page.tsx`
- `apps/local-web/src/app/styles.css`
- `docs/demo-intro.md`
- `README.md`

Required steps:

1. dashboard에서 최신 세션, 처리 상태, 검수 상태를 더 분명하게 보여준다.
2. session detail에서 `EXAONE 처리 -> MISO 전달 승인 -> MISO payload 확인` 흐름이 한눈에 보이게 정리한다.
3. 모델이 없어도 fallback-local이 데모 실패처럼 보이지 않게 문구를 다듬는다.
4. copy/download payload 버튼이 필요한지 검토하고, 시간이 되면 추가한다.

Verification:

```bash
pnpm typecheck
pnpm build
curl -fsS http://localhost:3000/api/sessions
```

Completion evidence:

- 데모 순서 5단계 이하
- UI에서 처리/검수/MISO 상태가 명확히 보이는 화면
- README 또는 demo intro에 동일한 순서 반영

Adversarial review focus:

- UI가 마케팅 페이지처럼 흩어지지 않고 실제 사용 화면으로 남아 있는지
- raw transcript가 MISO payload 영역에 섞여 보이지 않는지
- 모바일/작은 화면에서 버튼과 긴 ID가 깨지지 않는지

### T3. Reproducibility And Black-Box Test Pass

Status: `ready`

Goal:

새 Mac에서 clone한 사람이 문서만 보고 샘플 세션까지 재현할 수 있는지 검증한다.

Scope:

- `docs/m1-macbook-setup.md`
- `README.md`
- `.env.example`
- `scripts/test-channel-talk-ingest.mjs`
- 필요 시 별도 smoke script

Required steps:

1. 문서 명령어를 fresh clone 기준으로 읽고 누락된 전제 조건을 찾는다.
2. Channel Talk 키 없이 sample ingest가 성공하는지 확인한다.
3. Channel Talk 키가 있을 때 credential check/backfill 경로가 명확한지 확인한다.
4. 모델 미설치 상태에서도 EXAONE process 버튼이 fallback으로 성공하는지 확인한다.

Verification:

```bash
pnpm install
cp .env.example .env.local
pnpm typecheck
set -a; source .env.local; set +a
pnpm test:ingest
curl -fsS http://localhost:3000/api/sessions
```

Completion evidence:

- README와 M1 문서의 명령어 불일치 없음
- 키 없이 가능한 경로와 키가 필요한 경로가 분리되어 있음
- 문제가 있으면 문서/스크립트 수정

Adversarial review focus:

- `.env.local` 예시가 실제 실행에 충분한지
- `PHONE_CLAW_STORAGE_DIR` 상대 경로가 monorepo 실행 위치에서 안전한지
- model download가 선택 사항으로 설명되어 있는지

### T4. Local Voice Capture Frontdoor

Status: `planned`

Goal:

Channel Talk가 아니어도 사용자가 회의/음성 파일을 로컬로 넣어 같은 세션 계약으로 처리하는 private mode를 만든다.

Scope:

- new upload or recording UI under `apps/local-web`
- local session storage adapter
- `docs/local-models.md`
- `current/private-local-voice-agent-architecture.md`

Required steps:

1. 웹 파일 업로드 또는 브라우저 녹음 중 하나만 선택한다.
2. 업로드된 파일은 로컬 저장소에만 보관한다.
3. whisper.cpp STT는 모델/CLI가 있을 때만 실행하고, 없으면 sample transcript/fallback으로 세션을 만든다.
4. 이후 EXAONE/review/MISO payload는 기존 session detail을 재사용한다.

Verification:

```bash
pnpm typecheck
pnpm build
whisper-cli -m models/whisper/ggml-small.bin -f <short-audio-file> -otxt -of /tmp/phone-claw-stt
```

Completion evidence:

- Channel Talk가 없어도 local voice session 생성 가능
- 기존 EXAONE/review/MISO 흐름으로 이어짐

Adversarial review focus:

- 음성 파일이 외부로 나가지 않는지
- 대용량 파일 업로드가 UI/API를 불안정하게 만들지 않는지
- STT 실패 시 사용자에게 명확한 상태를 보여주는지

### T5. MISO Proposal Package

Status: `planned`

Goal:

MISO 직접 push가 아니라 "MISO에 추가되면 좋은 inbound voice event interface"를 명확한 산출물로 제안한다.

Scope:

- `miso/README.md`
- `miso/phone-claw-openapi.json`
- `miso/mcp-tool-proposal.json`
- `docs/demo-intro.md`
- 필요 시 local UI의 payload preview/download

Required steps:

1. 현재 MISO guide 기준 가능한 것과 불가능한 것을 한 문단으로 정리한다.
2. Phone-Claw redacted payload schema를 심사위원이 바로 이해할 수 있게 예시화한다.
3. MISO 앱/워크플로우가 이 payload를 받으면 어떤 업무가 자동화되는지 보여준다.
4. 발표 문구를 "우리는 직접 MISO에 몰래 넣었다"가 아니라 "필요한 인터페이스를 검증 가능한 payload와 함께 제안한다"로 통일한다.

Verification:

```bash
node -e "JSON.parse(require('fs').readFileSync('miso/phone-claw-openapi.json','utf8')); JSON.parse(require('fs').readFileSync('miso/mcp-tool-proposal.json','utf8')); console.log('ok')"
```

Completion evidence:

- schema JSON parse 성공
- README에 gap/proposal/demo path가 분리되어 있음
- UI나 문서에 redacted payload 예시 존재

Adversarial review focus:

- MISO 기능을 과장하지 않는지
- 원문/개인정보가 예시 payload에 포함되지 않는지
- LG U+ Voice AI + EXAONE 조건도 같이 설명되는지

### T6. Submission Pack

Status: `planned`

Goal:

GitHub 링크와 소개 페이지/발표 자료만 보고도 Phone-Claw의 가치와 데모 방법을 이해할 수 있게 정리한다.

Scope:

- `README.md`
- `docs/demo-intro.md`
- optional screenshots/videos under ignored or committed safe asset path
- `current/implementation-status.md`

Required steps:

1. 1분 pitch, 3분 demo, fallback demo 순서를 작성한다.
2. README 첫 화면에 "무엇을 만들었는지"와 "어떻게 실행하는지"를 더 명확히 둔다.
3. 민감정보/보안 구조를 간단한 다이어그램으로 설명한다.
4. 제출 직전 `git status`, build, 주요 API smoke test를 실행한다.

Verification:

```bash
git status --short
pnpm typecheck
pnpm build
curl -fsS http://localhost:3000/api/sessions
```

Completion evidence:

- 제출용 GitHub URL
- README만 보고 실행 가능한 상태
- 최종 데모 순서 문서화

Adversarial review focus:

- 제출 문서가 현재 구현보다 앞서가지 않는지
- live Channel Talk가 실패해도 sample/fallback demo가 가능한지
- sponsor track 조건이 첫 페이지에서 드러나는지

## Recommended Next Work Unit

가장 먼저 잡을 작업 단위는 **T2. Demo Flow Hardening**이다.

이유:

- realtime webhook은 실제 합성 이벤트로 증명됐고, 다음 병목은 심사위원에게 보이는 golden path다.
- Channel Talk 입력이 들어온 뒤 `EXAONE 처리 -> human review -> MISO proposal`이 한 화면에서 설득력 있게 보여야 한다.
- live webhook이 흔들려도 sample/backfill path로 같은 제품 가치를 보여줄 수 있어야 한다.

T2가 끝나면 **T3. Reproducibility And Black-Box Test Pass**로 넘어가서 M1 MacBook에서도 문서만 보고 재현되는지 확인한다.
