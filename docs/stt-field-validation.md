# STT Field Validation

This document prepares the real-use STT checks for Phone-Claw Private Mode.

## Goal

Confirm that voice files can be transcribed locally on the Mac mini M4 without
sending raw audio to an external service.

## Current Local State

Expected local tools:

```text
whisper-cli
models/whisper/ggml-small.bin
```

The model file is intentionally ignored by git. Install instructions are in
`docs/local-models.md`.

## Fast Check

Run:

```bash
pnpm check:stt
```

By default, this uses Homebrew's bundled `jfk.wav` sample if available. You can
pass a real sample file:

```bash
pnpm check:stt /absolute/path/to/short-meeting.wav
```

Expected output:

```json
{
  "ok": true,
  "transcriptPreview": "..."
}
```

Keep the temporary transcript file for inspection:

```bash
PHONE_CLAW_STT_KEEP_TMP=1 pnpm check:stt /absolute/path/to/sample.wav
```

## Private Mode File Upload Check

1. Start the local app:

```bash
set -a; source .env.local; set +a
pnpm dev
```

2. Open `http://localhost:3000`.
3. Use `Private Mode`.
4. Select `회의`, `통화`, or `음성 메모`.
5. Upload a short audio file and submit.
6. Open the created session.

Expected:

- With `whisper-cli` and `ggml-small.bin`, the session has transcript text.
- Without them, the session is still stored with `fallback_pending` so the
  local source file is not lost.

## Recommended Test Samples

Use three small local files:

- 10-20 second clean Korean speech
- 30-60 second meeting-style speech with pauses
- noisy or far-field speech

For each sample, record:

```text
file name
duration
file size
language
runtime
transcript quality notes
whether EXAONE processing still produced useful action items
```

## Acceptance Criteria For Demo

- `pnpm check:stt` passes.
- One Korean voice sample produces a usable transcript locally.
- Private Mode can create a session from that transcript or audio file.
- EXAONE/fallback processing can turn the transcript into summary/action items.
- MISO handoff remains blocked until review.

## Known Limits

- `ggml-small.bin` is good enough for a demo, but longer or noisy Korean audio
  may need better model tuning or a larger model.
- Browser upload is not the same as browser recording. The current MVP supports
  transcript paste and file upload; a one-click recorder is a separate UI task.
- Large files should be kept out of public demos until timeout and storage
  behavior are tested.
