You are a non-interactive implementation worker in `/Users/bot_mandu/Documents/ixi-o-agent`.

Task:
Implement the showcase demo redesign described in `docs/showcase-demo-redesign-plan.md`.

Context:
- This is an OBA Weekend-thon submission for `ixi-O Agent`.
- The demo page should help judges vividly understand the product, not read code details.
- Product message: `일상의 Voice를 에이전트와 함께`.
- LG U+ track evidence must show Voice AI + EXAONE.
- MISO track evidence must show a safe inbound voice-context handoff.
- Enterprise mode must emphasize local processing, masking, and review gate.
- Personal mode must emphasize full-context personal handoff.

Primary files:
- `apps/local-web/src/app/showcase/page.tsx`
- `apps/local-web/src/app/showcase/ShowcaseDemo.tsx`
- `apps/local-web/src/app/styles.css`

Implementation requirements:
1. Put a visible enterprise/personal mode switch above the fold.
2. Make the hero feel like an actual product demo with a live flow board.
3. Keep the existing interactive step flow but make it more vivid and judge-friendly.
4. Add a clear privacy/security boundary:
   - enterprise: raw audio/full transcript/PII local only -> redacted summary/decisions/action candidates to agents
   - personal: full context intentionally preserved for the user's own agent
5. Add concise proof points for LG U+, MISO, local-first, and human review.
6. Use the existing LG U+ / ixi-O inspired CSS tokens and TDS-inspired component style.
7. Keep 8px radii and operational UI density. Do not add decorative blobs/orbs.
8. Do not add secrets, API keys, or unrelated refactors.

Copy to use:
- Hero H1: `일상의 Voice를 에이전트와 함께`
- Hero support: `Voice를 에이전트가 바로 쓸 수 있는 안전한 업무 맥락으로 바꿉니다.`
- Enterprise short copy: `검수된 payload만 MISO와 Kiya로 갑니다.`
- Security line: `개인정보는 로컬에 두고, 결정만 보냅니다.`

Verification:
- Run `pnpm typecheck`.
- Run `pnpm build`.
- If feasible, start the dev server and inspect `/showcase` at desktop and mobile widths.
- Summarize changes and any verification failures in your final output.

Important:
- Do not press any OBA final submit button.
- Do not change repository name or remote.
- Do not commit unless explicitly instructed by the manager after review.
