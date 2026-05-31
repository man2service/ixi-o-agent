import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(new URL("..", import.meta.url).pathname);
const whisperCli = process.env.WHISPER_CLI_PATH ?? "whisper-cli";
const modelPath =
  process.env.IXI_O_AGENT_WHISPER_MODEL_PATH ??
  process.env.PHONE_CLAW_WHISPER_MODEL_PATH ??
  path.join(workspaceRoot, "models", "whisper", "ggml-small.bin");
const audioPath = process.argv[2] ?? (await findDefaultAudioPath());

if (!audioPath) {
  throw new Error(
    "missing_audio_file: pass an audio path, e.g. pnpm check:stt /path/to/sample.wav"
  );
}

await assertReadable(modelPath, "whisper_model_not_readable");
await assertReadable(audioPath, "audio_file_not_readable");

const tempRoot = await mkdtemp(path.join(tmpdir(), "ixi-o-agent-stt-"));
const outputStem = path.join(tempRoot, "stt-output");

try {
  const startedAt = Date.now();
  const run = await runCommand(whisperCli, [
    "-m",
    modelPath,
    "-f",
    audioPath,
    "-otxt",
    "-of",
    outputStem
  ]);
  const outputText = (await readFile(`${outputStem}.txt`, "utf8")).trim();
  if (!outputText) {
    throw new Error(`stt_empty_output:${run.stderr.slice(-500)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        modelPath,
        audioPath,
        durationMs: Date.now() - startedAt,
        transcriptPreview: outputText.slice(0, 300),
        outputFile: `${outputStem}.txt`
      },
      null,
      2
    )
  );
} finally {
  if ((process.env.IXI_O_AGENT_STT_KEEP_TMP ?? process.env.PHONE_CLAW_STT_KEEP_TMP) !== "1") {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function findDefaultAudioPath() {
  const candidates = [
    "/opt/homebrew/Cellar/whisper-cpp/1.8.4/share/whisper-cpp/jfk.wav",
    "/usr/local/Cellar/whisper-cpp/1.8.4/share/whisper-cpp/jfk.wav"
  ];
  for (const candidate of candidates) {
    try {
      await assertReadable(candidate, "candidate_not_readable");
      return candidate;
    } catch {
      // Try the next common Homebrew location.
    }
  }
  return undefined;
}

async function assertReadable(filePath, errorCode) {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`${errorCode}:${filePath}`);
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`command_failed:${command}:${code}:${stderr.slice(-1000)}`));
    });
  });
}
