# Showcase Demo Redesign Plan

Date: 2026-05-31

## Goal

Turn the public demo page into an experiential judging surface, not a code or architecture explanation page.

The first 30 seconds should let a judge picture the product:

> Calls and meetings are processed on a local server, then only the right context is handed to agents.

## Primary Message

Korean:

> 일상의 Voice를 에이전트와 함께

Support:

> Voice를 에이전트가 바로 쓸 수 있는 안전한 업무 맥락으로 바꿉니다.

Do not describe this as "privacy law bypass." Use safer language:

> 외부 전송을 최소화하고, 로컬 처리와 비식별화로 개인정보 처리 리스크를 줄입니다.

## Target Page

Primary implementation target:

- `apps/local-web/src/app/showcase/page.tsx`
- `apps/local-web/src/app/showcase/ShowcaseDemo.tsx`
- `apps/local-web/src/app/styles.css`

The static showcase can be left unchanged unless the worker has enough time to mirror the same content.

## Required User Experience

1. Hero
   - Reduce code/project explanation.
   - Make the product feel like a live demo.
   - Show an obvious enterprise/personal mode switch above the fold.
   - The right side should look like a live Voice-to-Agent flow board.

2. Enterprise Mode
   - Source: Channel Talk phone/recording data via n8n.
   - Processing: Mac mini M4 local server.
   - AI: Whisper STT plus EXAONE post-processing.
   - Privacy: raw audio and full transcript stay local.
   - Gate: PII and company secrets are masked before external handoff.
   - Output: review-approved decisions and action candidates go to Kiya/Hermes and MISO handoff.

3. Personal Mode
   - Source: local meeting/call recording or uploaded voice file.
   - Processing: private local server.
   - AI: Whisper STT plus EXAONE full-context summary.
   - Privacy: no masking by default because this is the user's personal agent.
   - Output: full transcript plus summary and action candidates go to Kiya/Hermes.

4. Privacy Gate
   - Make the enterprise privacy boundary visually explicit.
   - Suggested comparison:
     - Local only: raw audio, full transcript, phone number, names, addresses.
     - Agent handoff: redacted summary, decisions, owner, due date, action candidates.
   - Personal mode should make clear that full context is intentionally preserved.

5. Interactive Simulation
   - Keep the existing step interaction, but make the right panel more vivid:
     - "incoming event"
     - "local processing"
     - "EXAONE result"
     - "privacy gate"
     - "Kiya/MISO handoff"
   - Clicking "단계 완료" should feel like a presentation operator moving through a demo.

6. Judging Proof Strip
   - Add short proof points:
     - LG U+ Track: Voice AI plus EXAONE.
     - GS/MISO Track: safe inbound voice context proposal.
     - Local-first: Mac mini M4 processing.
     - Human review: external handoff after approval.

## Visual Direction

Use the existing LG U+ / ixi-O inspired tokens already defined in `styles.css`.

Design rules:

- Avoid giant marketing copy blocks.
- Use clean, operational product UI.
- Keep card radius at 8px.
- Keep typography tight and readable.
- Avoid one-hue-only purple/blue treatment.
- Use the existing TDS-inspired button and list hierarchy.
- Do not add decorative orb/blob backgrounds.
- Ensure mobile has no text overlap.

## Copy Requirements

Hero H1:

> 일상의 Voice를 에이전트와 함께

Hero support:

> Voice를 에이전트가 바로 쓸 수 있는 안전한 업무 맥락으로 바꿉니다.

Enterprise short copy:

> 검수된 payload만 MISO와 Kiya로 갑니다.

Personal short copy:

> Voice를 안전한 업무 맥락으로 바꿉니다.

Security copy:

> 개인정보보호법 우회가 아니라, 외부 전송을 줄이고 비식별화와 검수 경계로 처리 리스크를 낮추는 구조입니다.

## Acceptance Criteria

- The page clearly shows enterprise/personal toggle above the fold.
- Enterprise mode emphasizes Channel Talk, local Mac mini processing, masking, review gate, Kiya/Hermes, MISO handoff.
- Personal mode emphasizes local voice input, full-context handoff, Kiya confirmation for actions.
- There is an explicit visual privacy/security boundary.
- The interactive demo still works.
- The page builds with `pnpm build`.
- TypeScript passes with `pnpm typecheck`.
- Browser QA covers desktop and mobile widths.
- No API keys or secrets are added.
- Do not press any OBA final submit button.
