# MISO Track Judge One-Pager

## One Sentence

ixi-O Agent turns calls and meetings into reviewed, redacted voice-session
handoffs that MISO can safely use as enterprise workflow input.

## Why This Fits MISO

MISO Track asks builders to handle real enterprise constraints, not just clean
public APIs. ixi-O Agent does that by making voice context safe enough for MISO:

- raw audio and raw transcript stay local
- EXAONE creates structured work context after STT
- human review gates every external handoff
- MISO reads only approved redacted payloads through a custom REST tool
- the project proposes the next MISO interface: inbound voice events or MCP
  resource ingest

## What To Show First

1. Public demo: `https://ixi-o-agent.vercel.app`
2. MISO app: `ixi-O Agent VoiceOps Copilot`
3. Prompt:

```text
승인된 voice session 목록을 보고 업무 카드로 정리해 주세요.
```

Expected MISO answer:

- business card
- urgency
- owner team
- next actions
- human review requirement
- current custom-tool pull path
- next inbound/MCP interface proposal

## If Live Tool Fails

Use the fallback payload:

```text
아래 redacted handoff JSON을 MISO 업무 액션으로 바꿔 주세요.
```

Then paste:

- `miso/samples/approved-voice-session-handoff.sample.json`

To prove the review gate, paste:

- `miso/samples/blocked-voice-session-detail.sample.json`

## What Not To Claim

- Do not claim MISO has a direct inbound voice API today.
- Do not claim ixi-O Agent pushes raw audio or raw transcript to MISO.
- Do not claim automatic redaction is perfect. Say: deterministic redaction plus
  human review.

## Strongest Closing

MISO does not need to become a voice recorder. It needs a safe way to receive
voice-derived work context. ixi-O Agent shows that interface today as a custom
tool and proposes the first-class schema MISO should open next.

