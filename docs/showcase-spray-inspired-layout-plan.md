# Spray-Inspired Showcase Layout Plan

Date: 2026-05-31

Status: Keep for later implementation. Do not implement until explicitly resumed.

## Intent

Move `/showcase` from a dense product demo board toward a more spacious judging and marketing page.

The first viewport should make judges feel the product before asking them to parse the architecture.

## Proposed Page Structure

1. Hero stage
   - H1: `일상의 Voice를 에이전트와 함께`
   - Support: `통화와 회의를 안전한 업무 맥락으로 바꿉니다.`
   - Primary CTA: `시연 시작`
   - Secondary CTA: `GitHub`
   - Centerpiece: one large `Voice -> Local AI -> Agent` demo frame.
   - Enterprise/personal toggle should remain visible but smaller.

2. Scroll hint
   - Let the next section peek into the first viewport.
   - Use a short phrase such as `통화가 들어오면`.

3. Problem section
   - Three short beats:
     - `통화는 흩어지고`
     - `회의는 잊히고`
     - `에이전트는 맥락을 모릅니다`

4. Flow section
   - Reduce to three core steps:
     - `Voice 수집`
     - `로컬 STT/EXAONE 처리`
     - `Kiya/MISO 액션 제안`
   - Move the current interactive stepper here.

5. Enterprise / Personal split
   - Enterprise: `원문은 로컬에, 검수된 payload만 전달`
   - Personal: `전체 맥락을 내 에이전트에게 전달`

6. Security boundary
   - Move the Local-only vs Agent-handoff comparison out of the hero.
   - Make it a dedicated proof section.

7. Track proof
   - LG U+: `Voice AI + EXAONE`
   - GS Neotek / MISO: `안전한 inbound voice context`
   - Local-first: `Mac mini 로컬 처리`

## What To Remove From The First Viewport

- Proof strip
- Local/Agent boundary table
- Four-step pipeline buttons
- Long security explanation
- Detailed result sentences

## Design Notes

- Borrow Spray's stage-like spacing and central demo frame.
- Keep ixi-O / LG U+ branding rather than copying Spray's dark style directly.
- Use more whitespace, but keep the page judging-friendly and short.
- The goal is a vivid demo landing page, not a long marketing site.

