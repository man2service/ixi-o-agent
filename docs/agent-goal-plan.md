# OBA Award Goal Plan

Updated: 2026-05-31 KST

## Mission

Prepare ixi-O Agent as a judge-ready OBA Weekend-thon S1 submission for both:

- LG U+ Track Award: prove a Voice AI use case with EXAONE in the processing pipeline.
- GS Neotek / MISO Track Award: prove a practical, secure way for MISO to consume voice-derived enterprise context.

Product message:

```text
일상의 모든 Voice를, 에이전트와 함께
```

## Current Position

The project already has a working local-first path:

```text
Channel Talk or Private Mode
  -> local ixi-O Agent session store
  -> Whisper STT where audio exists
  -> EXAONE post-processing
  -> Kiya summary and optional calendar prompt
  -> human review gate
  -> redacted MISO custom-tool handoff
```

The demo intentionally does not claim unsupported direct ixi-O or MISO inbound
integration. Current MISO integration is a custom-tool pull path plus an
interface proposal for a future inbound voice-session event/MCP resource ingest.

## Run Policy

Allowed in this run:

- Update local docs, README, runbooks, MISO proposal files, and safe demo assets.
- Run local validation commands that do not transmit customer data.
- Commit and push source/documentation changes to the GitHub `main` branch.
- Use independent read-only sub-agent reviews for LG U+, MISO, and fresh-clone readiness.

Not allowed in this run without a separate explicit action:

- Commit `.env.local`, tokens, passwords, raw transcripts, raw audio, model files, n8n runtime data, or private inbox contents.
- Send real customer transcript content to MISO, Telegram, external LLMs, or public pages.
- Reconfigure live Channel Talk/MISO/Telegram settings unless the user explicitly starts a live rehearsal.
- Claim that MISO supports direct inbound voice ingest today.

Stop or escalate if:

- A validation failure points to a real broken demo path that cannot be fixed locally.
- A live external service write is required.
- A judge-facing claim would exceed what the current code proves.

## P0 Work Items

1. Preserve a judge-readable evidence matrix in `docs/submission-pack.md`.
2. Keep MISO-specific setup and fallback paths in `docs/miso-track-submission-runbook.md`.
3. Keep exact user-owned actions in `TODO_USER_ACTIONS.md`.
4. Validate local build, smoke path, and MISO artifacts before final handoff.
5. Save independent review findings under `docs/reviews/` and reflect any concrete gaps.

## Award Evidence Matrix

| Track | Requirement | Current Evidence | Demo Proof |
| --- | --- | --- | --- |
| LG U+ | Voice AI topic | Channel Talk voice-derived sessions, Private Mode recorder/upload, local transcript/session model | Public showcase Enterprise/Personal flow and local session detail |
| LG U+ | EXAONE usage | `apps/local-web/src/lib/exaone.ts`, local model docs, process API, session EXAONE output | Run EXAONE processing or show fallback-labeled proof session with local model path explained |
| LG U+ | Privacy/security | Local storage, local Whisper/EXAONE plan, review gate before MISO | Show raw transcript local, MISO redacted payload only after approval |
| MISO | Usable app/workflow artifact | `miso/apps/ixi-o-agent-voiceops-copilot.yml`, OpenAPI custom tool schemas | Import app/tool in MISO or use fallback JSON paste |
| MISO | Concrete platform proposal | `miso/proposed-inbound-voice-event.schema.json`, `miso/mcp-tool-proposal.json` | Explain custom-tool pull now, inbound voice event/MCP next |
| MISO | Security hardening | Gateway-only tunnel, bearer token split, no raw transcript/audio in MISO response | Gateway route checks and blocked-before-review sample |

## Validation Targets

Run before declaring the submission ready:

```bash
git status --short
pnpm typecheck
pnpm build
pnpm smoke:local
pnpm smoke:exaone
node -e "for (const f of ['miso/ixi-o-agent-openapi.json','miso/ixi-o-agent-openapi.v3.json','miso/mcp-tool-proposal.json','miso/proposed-inbound-voice-event.schema.json','miso/samples/approved-voice-session-handoff.sample.json','miso/samples/blocked-voice-session-detail.sample.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok')"
ruby -e "require 'yaml'; YAML.load_file('miso/apps/ixi-o-agent-voiceops-copilot.yml'); puts 'ok'"
```

`pnpm smoke:exaone` proves the real EXAONE GGUF path on the Mac mini M4 when
`llama-cli` and the model file are installed. `pnpm check:stt` is also
recommended for final rehearsal, but it depends on the local Whisper binary/model
and should not block the credential-free judge fallback path.

## Final Judge Narrative

1. Voice is where valuable work context starts, but enterprise agents need safe structured context.
2. ixi-O Agent keeps raw voice/transcripts local, then uses Whisper and EXAONE to create structured intent.
3. The user reviews the result before any external workflow sees it.
4. MISO receives only a redacted, decision-ready handoff and can turn it into enterprise work.
5. The product becomes stronger when ixi-O call history and MISO inbound voice events are connected as first-class integrations.
