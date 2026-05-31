# Voice Session Workflow Outline For MISO

This is the workflow shape to build in MISO when a visual workflow app is used
instead of the current agent-chat app.

## Inputs

- `sessionId` when the custom tool is connected.
- `handoffJson` when using the judging fallback paste path.

## Steps

1. Normalize input.
   - If `sessionId` exists, call `readVoiceSessionHandoff`.
   - If no `sessionId`, parse `handoffJson`.
2. Branch on review gate.
   - If `availableForExternalWorkflow` is false, return a blocked card:
     "human review required; no raw transcript/audio available."
   - If available, continue.
3. Build business card.
   - title
   - request type
   - urgency
   - required teams
   - source mode/system
4. Generate next actions.
   - 3-5 operator actions
   - mark which actions require human approval
5. Generate interface note.
   - now possible: MISO pulls reviewed redacted payload via custom tool
   - proposed next: inbound `voice-session.created` event or MCP resource ingest

## Output Contract

```text
### 1. 업무 카드
- 제목:
- 요청 유형:
- 긴급도:
- 담당팀:
- 검수 상태:

### 2. 고객/회의 맥락 요약

### 3. 다음 행동 제안

### 4. Human Review

### 5. MISO 실행/인터페이스 제안
```

## Demo Value

This workflow makes the GS Neotek/MISO value concrete: MISO is not storing raw
voice, but it can still own the enterprise action flow once ixi-O Agent has
converted voice into a reviewed, redacted handoff.
