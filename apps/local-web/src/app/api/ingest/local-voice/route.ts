import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { type ChannelTalkN8nPayload } from "@phone-claw/core";
import { getWorkspaceRoot, ingestChannelTalkPayload } from "@phone-claw/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalMode = ChannelTalkN8nPayload["mode"];

const DEFAULT_WHISPER_MODEL = path.join(
  getWorkspaceRoot(),
  "models",
  "whisper",
  "ggml-small.bin"
);

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = getFormString(formData, "title") ?? "Local voice";
  const mode = normalizeMode(getFormString(formData, "mode"));
  const manualTranscript = getFormString(formData, "transcriptText") ?? "";
  const audioFile = getAudioFile(formData);
  const startedAt = new Date();
  const tempDir = path.join(tmpdir(), `phone-claw-local-${randomUUID()}`);

  let tempAudioPath: string | undefined;
  let transcriptText = manualTranscript.trim();
  let sttReason: string | undefined;

  try {
    if (audioFile) {
      await mkdir(tempDir, { recursive: true });
      tempAudioPath = path.join(tempDir, `source${getSafeExtension(audioFile.name)}`);
      await writeFile(tempAudioPath, Buffer.from(await audioFile.arrayBuffer()));

      if (!transcriptText) {
        const stt = await transcribeWithLocalWhisper(tempAudioPath, tempDir);
        transcriptText = stt.text.trim();
        sttReason = stt.reason;
      }
    }

    if (!transcriptText && !audioFile) {
      return NextResponse.json(
        { ok: false, error: "local_voice_requires_transcript_or_audio" },
        { status: 400 }
      );
    }

    const sourceId = `local_${startedAt.getTime()}_${randomUUID().slice(0, 8)}`;
    const payload: ChannelTalkN8nPayload = {
      source: "local_voice_upload",
      status: transcriptText ? "ready" : "fallback_pending",
      reason: transcriptText ? undefined : sttReason ?? "local_voice_transcript_pending",
      mode,
      channelId: "local-voice",
      userChatId: sourceId,
      callDirection: "unknown",
      startedAt: startedAt.toISOString(),
      participants: [
        {
          id: "local_operator",
          role: "user",
          displayName: "Local operator"
        }
      ],
      transcript: transcriptText
        ? [
            {
              speaker: mode === "meeting" ? "meeting" : "local",
              text: transcriptText,
              timestampMs: 0
            }
          ]
        : [],
      recordingUrl: null,
      rawEvent: {
        source: "api/ingest/local-voice",
        title,
        mode,
        audioFileName: audioFile?.name,
        audioFileSize: audioFile?.size,
        sttReason
      }
    };

    const result = await ingestChannelTalkPayload(payload);
    if (tempAudioPath && audioFile) {
      const sourceDir = path.join(result.sessionPath, "source");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        path.join(sourceDir, `local-audio${getSafeExtension(audioFile.name)}`),
        await readFile(tempAudioPath)
      );
    }

    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.redirect(new URL(`/sessions/${result.sessionId}`, request.url), 303);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function transcribeWithLocalWhisper(audioPath: string, tempDir: string) {
  const modelPath = process.env.PHONE_CLAW_WHISPER_MODEL_PATH ?? DEFAULT_WHISPER_MODEL;
  if (!(await fileExists(modelPath))) {
    return {
      text: "",
      reason: "whisper_model_missing"
    };
  }

  const outputBase = path.join(tempDir, "whisper-output");
  const command = process.env.PHONE_CLAW_WHISPER_CLI ?? "whisper-cli";
  const result = await runCommand(command, [
    "-m",
    modelPath,
    "-f",
    audioPath,
    "-otxt",
    "-of",
    outputBase
  ]);

  if (result.code !== 0) {
    return {
      text: "",
      reason: `whisper_failed:${result.stderr.slice(0, 180)}`
    };
  }

  const text = await readFile(`${outputBase}.txt`, "utf8").catch(() => "");
  return {
    text,
    reason: text.trim() ? undefined : "whisper_empty_transcript"
  };
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getAudioFile(formData: FormData): File | undefined {
  const value = formData.get("audioFile");
  return value instanceof File && value.size > 0 ? value : undefined;
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeMode(value: string | undefined): LocalMode {
  if (value === "call" || value === "meeting" || value === "voice_note") return value;
  return "meeting";
}

function getSafeExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return /^[a-z0-9.]{1,12}$/.test(extension) ? extension : ".audio";
}
