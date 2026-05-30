# Local STT And EXAONE Models

Phone-Claw keeps voice processing local for the hackathon demo.

## Installed Tools

- `whisper-cli` from `whisper.cpp`
- `llama-cli` from `llama.cpp`

## Local Model Files

These files are intentionally ignored by git:

```text
models/whisper/ggml-small.bin
models/exaone/EXAONE-4.0-1.2B-Q4_K_M.gguf
```

## Install On Another Mac

```bash
brew install whisper-cpp llama.cpp
mkdir -p models/whisper models/exaone
curl -L \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin \
  -o models/whisper/ggml-small.bin
python3 -m pip install --user -U "huggingface_hub[cli]"
huggingface-cli download LGAI-EXAONE/EXAONE-4.0-1.2B-GGUF \
  --include "EXAONE-4.0-1.2B-Q4_K_M.gguf" \
  --local-dir models/exaone
```

If these files are missing, the local web app still works. The EXAONE process
button will produce a `fallback-local` result instead of real GGUF inference.

## STT Smoke Test

Preferred reusable command:

```bash
pnpm check:stt
```

With a specific local audio file:

```bash
pnpm check:stt /absolute/path/to/short-audio.wav
```

Direct `whisper-cli` command:

```bash
whisper-cli \
  -m models/whisper/ggml-small.bin \
  -f /opt/homebrew/Cellar/whisper-cpp/1.8.4/share/whisper-cpp/jfk.wav \
  -otxt \
  -of /tmp/phone-claw-jfk
```

Verified on the local Mac mini M4:

```text
And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.
```

## EXAONE Smoke Test

```bash
llama-cli \
  -m models/exaone/EXAONE-4.0-1.2B-Q4_K_M.gguf \
  -p '다음 전사문을 업무 메모 JSON으로 요약해줘. 전사문: 고객이 내일 오전까지 견적서를 요청했다.' \
  -n 80 \
  --temp 0 \
  -st \
  --no-display-prompt \
  --no-show-timings \
  --simple-io
```

Verified output shape:

```json
{
  "업무 내용": {
    "고객 요청 사항": "내일 오전까지 견적서 제공",
    "추가 지시 사항": null
  }
}
```

## Notes

- The model files should not be committed.
- The EXAONE test uses single-turn mode so `llama-cli` exits after one response.
- The demo pipeline can start with Channel Talk text input while the local STT path is used for privacy-focused voice capture.
