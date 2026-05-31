# OBA Award Adversarial Review

Date: 2026-05-31 KST

Scope: independent read-only reviews for LG U+ Track, GS Neotek / MISO Track,
and fresh-clone demo readiness.

## LG U+ Track Review

Verdict: strong but needed one additional proof path.

Strong evidence:

- The product is clearly Voice AI: Channel Talk voice-derived sessions, Private
  Mode recorder/upload, transcript storage, local session review, and agent
  handoff.
- EXAONE is implemented in `apps/local-web/src/lib/exaone.ts` and returns
  `engine: "exaone-local"` when the GGUF model and `llama-cli` are available.
- Local STT and EXAONE install docs exist in `docs/local-models.md`.

Risks found:

- `pnpm smoke:local` intentionally proves fallback behavior, not real EXAONE
  inference.
- Judges may ask whether EXAONE actually ran in the demo flow.
- EXAONE should be positioned as post-STT reasoning, not as STT.

Actions taken:

- Added `pnpm smoke:exaone` to prove real local EXAONE inference with
  `engine: "exaone-local"` and `modelAvailable: true`.
- Updated `docs/submission-pack.md` to separate fallback smoke from real local
  model proof.
- Added explicit copy that EXAONE is used after STT for summary, decisions,
  action candidates, and agent-readable context.

Local verification after the fix:

```text
pnpm smoke:exaone -> ok, engine: exaone-local, modelAvailable: true
pnpm check:stt -> ok, Whisper small model produced a transcript preview
```

## GS Neotek / MISO Track Review

Verdict: conditionally submit-ready.

Strong evidence:

- MISO custom tool OpenAPI schemas parse and expose `listVoiceSessions` and
  `readVoiceSessionHandoff`.
- The MISO gateway exposes only the two MISO GET paths.
- The review gate blocks handoff before approval and returns only redacted
  payload after approval.
- The proposal honestly separates custom-tool pull now from inbound voice event
  and MCP resource ingest as future MISO platform suggestions.

Risks found:

- The importable MISO app YAML has `tools: []`; custom tool binding remains a
  manual workspace step.
- Live MISO publish/tool-test evidence should be captured before judging.
- Gateway token fallback to the long-lived ingest secret weakened the security
  story.
- PII masking should be described as deterministic redaction plus human review,
  not full automatic Korean PII coverage.

Actions taken:

- Updated `scripts/miso-tool-gateway.mjs` to fail closed unless
  `IXI_O_AGENT_MISO_GATEWAY_TOKEN` is explicitly set.
- Added `docs/miso-submit-evidence.md` for final live MISO evidence capture.
- Updated `docs/miso-track-submission-runbook.md` to explain manual custom-tool
  binding and evidence capture.
- Updated the submission pack security boundary.
- Added `miso/voice-session-workflow-outline.md` to show the workflow/chaining
  shape beyond the agent-chat app.

## Fresh-Clone Review

Verdict: clone/install/build/smoke path works.

Observed successful commands in a fresh temporary clone:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm smoke:local
```

Risks found:

- The fixed synthetic proof session ID exists on the working machine but not on
  a fresh clone.
- `pnpm check:stt` fails normally when Whisper model files are absent, which can
  look like a broken setup if not explained.
- Public source material included sponsor/operator contact details.

Actions taken:

- Added a 5-minute fresh demo path to `README.md`.
- Updated the demo runbook to explain fresh-clone session creation with
  `pnpm test:ingest`.
- Clarified STT/EXAONE model preconditions in README and runbook.
- Redacted LG U+ contact details from the public source-pack copy and updated
  the source-pack checksum.

## Remaining Human Actions

See `TODO_USER_ACTIONS.md`.
