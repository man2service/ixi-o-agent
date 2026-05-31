# Temporary Development Decision Questions

> 작성일: 2026-05-30 KST
> 상태: 임시 의사결정 문서
> 목적: 개발 착수 전 사용자가 정해야 할 질문을 보존
> 주의: 이 문서는 질문 보존용이다. 최신 결정은 `current/n8n-automation-hub-plan.md`와 `current/channel-talk-n8n-implementation-prereqs.md`를 우선한다.

---

## 1. 핵심 질문

1. 첫 화면은 `파일 업로드`를 메인으로 고정할까?
2. 발표/개발 메인 장비는 `Mac mini M4`로 잡을까?
3. Channel Talk+n8n은 `n8n sample workflow 기본 데모`로 고정할까? -> **결정: 예**
4. MISO는 `copy/download + 제안 schema`까지만 기본으로 둘까?
5. 다른 자동화가 붙을 가능성을 고려해 n8n을 먼저 붙일까? -> **결정: 예**

## 2. 추가로 정하면 좋은 질문

1. 첫 화면의 기본 CTA는 `파일 업로드`인가, `녹음 시작`인가?
2. 실제 STT/EXAONE은 발표 중 라이브 실행까지 보여줄까, 아니면 짧은 smoke demo와 사전 결과를 함께 보여줄까?
3. Review 화면에서 사용자가 수정할 수 있어야 하는 필드는 어디까지인가?
4. MISO에 `/ext/v1/chat` 실험 버튼을 노출할까, 아니면 문서/제안 schema로만 둘까?
5. 원본 음성과 전사문은 기본 보관할까, 아니면 `세션 삭제 / 데모 데이터 초기화`를 필수 흐름에 넣을까?

## 3. 현재 권장 기본값

```text
입력 1: 파일 업로드 우선, 녹음 보조
메인 장비: Mac mini M4
스택: Next.js App Router + TypeScript + pnpm workspace
처리 방식: job/status polling
STT: whisper.cpp small
EXAONE: EXAONE-4.0-1.2B GGUF Q4 + llama.cpp
Channel Talk: n8n sample payload 기본, live는 보너스
MISO: 직접 전송 아님, redacted payload 생성 + copy/download + 제안 schema
마스킹: rule-based + human review
```

## 4. 다음 결정 후보

채널톡 전사문을 n8n으로 먼저 가져오기로 했으므로, 다음으로는 아래를 정한다.

1. 채널톡 live 계정을 바로 연결할지, 먼저 n8n sample payload 저장 파이프라인부터 만들지 -> **결정: n8n sample payload 저장 파이프라인 먼저**
2. n8n을 cloud로 쓸지, 로컬/self-host로 쓸지 -> **결정: 로컬 n8n Docker 우선**
3. ixi-O Agent local bridge를 n8n에서 호출할 방법을 `localhost`, LAN IP, tunnel 중 무엇으로 둘지 -> **임시 결정: 로컬 n8n Docker면 `host.docker.internal`, npm/desktop이면 `localhost`**
4. 채널톡 전사문이 아직 없을 때 녹음 URL fallback까지 구현할지, transcript-only로 시작할지 -> **결정: transcript-only로 시작**
5. Channel Talk verified node를 설치할지, HTTP Request node로 시작할지 -> **결정: HTTP Request node로 시작**
6. 실시간 수집은 webhook으로 할지 polling으로 할지 -> **결정: webhook-first, polling backup**
7. polling 주기는 몇 분으로 둘지 -> **임시 결정: 2분**
8. 빌딩 중 과거 내역 import 방식 -> **결정: manual historical backfill workflow**
9. ixi-O Agent ingest secret 전달 방식 -> **결정: `x-ixi-o-agent-ingest-secret` header**
10. n8n execution data 보관 -> **임시 결정: 성공 실행 저장 끄기, 오류 실행만 저장, max age 24시간**
11. Channel Talk sample ingest 합격 기준 -> **결정: endpoint 호출, 세션/파일 생성, duplicate 재호출 무해성까지 확인**

## 5. 사용자 확인 사항

2026-05-30 KST 기준:

1. Channel Talk Open API credential은 사용자가 직접 발급받는 중이다.
2. Channel Talk Meet/전화 기능은 켜져 있다.
3. n8n은 앞서 결정한 대로 기본 자동화 허브로 사용한다.
4. Channel Talk API 호출은 `HTTP Request node` 우선으로 간다.
5. 수집 방식은 `Webhook-first + Polling backup`으로 간다.
6. 빌딩/테스트 중 과거 내역은 `manual historical backfill` workflow로 가져온다.
