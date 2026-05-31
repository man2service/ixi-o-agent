# MISO Track Readiness Review

Date: 2026-05-31 KST

Scope: GS Neotek / MISO track requirements, current repo evidence, and
adversarial sub-agent review.

## Source Criteria

From the MISO guide and GS Neotek track deck, the practical judging bar is:

1. Runnable MISO app: a human can run and verify the app in MISO.
2. Grounded: the team understands MISO features, constraints, and Document MCP.
3. Enterprise-real: the app handles approval, review, exceptions, and responsibility.
4. Agentic: the app judges, asks, summarizes, and proposes next actions.
5. Interface insight: blocked points become API, MCP, webhook, or schema proposals.

## Current Fit

| Requirement | Status | Evidence |
| --- | --- | --- |
| Runnable MISO app | Partial / live-verified | `docs/miso-submit-evidence.md`, live app URL, screenshots, and runtime answer. Risk: YAML alone has `tools: []`, so custom-tool binding is manual. |
| Custom REST tool | Pass | `miso/ixi-o-agent-openapi.v3.json`, `listVoiceSessions`, `readVoiceSessionHandoff`. |
| MCP / next interface proposal | Pass as proposal | `miso/mcp-tool-proposal.json`, `miso/proposed-inbound-voice-event.schema.json`, `miso/proposed-miso-interfaces.md`. |
| Enterprise workflow realism | Pass | MISO app prompt outputs business card, next actions, human review, and interface proposal. |
| Human review / approval | Pass | `pnpm smoke:local` verifies blocked-before-review and available-after-review behavior. |
| Security boundary | Pass with caveat | MISO gateway exposes only two GET paths and requires a dedicated short-lived token. Caveat: never tunnel the full Next app. |
| Document MCP grounding | Partial | Source docs were reviewed and runbook includes the official Document MCP config, but the live app evidence does not prove Document MCP is attached. |

## Verification Run

Commands run locally:

```bash
node -e "for (const f of ['miso/ixi-o-agent-openapi.json','miso/ixi-o-agent-openapi.v3.json','miso/mcp-tool-proposal.json','miso/proposed-inbound-voice-event.schema.json','docs/evidence/miso/ixi-o-agent-openapi.current-tunnel.v3.json']) { JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok', f) }"
ruby -e "require 'yaml'; YAML.load_file('miso/apps/ixi-o-agent-voiceops-copilot.yml'); puts 'yaml ok miso/apps/ixi-o-agent-voiceops-copilot.yml'"
pnpm miso:openapi:build-v3
pnpm typecheck
pnpm smoke:local
pnpm build
```

Observed:

- JSON and YAML validation passed.
- OpenAPI v3 regeneration was deterministic.
- `pnpm typecheck` passed.
- `pnpm smoke:local` passed and verified:
  - local sample ingest
  - fallback local processing
  - MISO blocked before review
  - MISO available after review
  - local voice frontdoor ingest
  - Kiya dry-run notification and calendar proposal logs
- `pnpm build` passed when run after smoke completed.
- A concurrent `pnpm build` + `pnpm smoke:local` run produced a transient
  Next `.next` page module error; this matches the runbook warning that build
  and live/dev smoke paths should not mutate/read `.next` simultaneously.
- Current documented tunnel returned:
  - `/api/miso/voice-sessions` without token: `401`
  - `/`: `404`

## Adversarial Findings

1. High: MISO app YAML is not self-contained runnable.
   - `miso/apps/ixi-o-agent-voiceops-copilot.yml` has `tools: []`.
   - Live MISO binding is workspace-specific and must be manually reattached.

2. High: Document MCP grounding is not proven in the live app.
   - The guide/deck emphasize Document MCP and grounded product understanding.
   - Current runbook treats Document MCP as optional.
   - Either attach Document MCP before judging or explicitly say the app was
     designed from source docs and the Document MCP path is a proposed/supporting
     setup.

3. High: Live demo depends on local machine, quick tunnel, and short-lived token.
   - Current evidence is good, but tunnel restart breaks the MISO tool until
     OpenAPI server URL and auth are refreshed.

4. Medium: Do not tunnel the full Next app.
   - The safe path is `pnpm miso:gateway`, which exposes only MISO GET routes.
   - Full local app routes include local session/review APIs intended for the
     operator UI.

5. Medium: Do not overclaim PII masking.
   - Position as deterministic redaction plus human review, not complete
     automatic Korean PII anonymization.

## Verdict

Conditionally submit-ready for the MISO track.

The core track story is strong: MISO receives reviewed, redacted voice-derived
business context through a custom tool today, while ixi-O Agent proposes a next
MISO interface for inbound voice events or MCP resource ingest.

Before final judging, the main remaining work is live operational proof:

1. Re-test MISO custom tool after refreshing tunnel/token.
2. Confirm the app is saved, shared, and ideally published.
3. Decide whether to attach Document MCP or explicitly frame it as source-grounded
   design rather than live app grounding.
4. Keep fallback JSON paste demo ready.
