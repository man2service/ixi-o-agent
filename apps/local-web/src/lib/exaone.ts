import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import type { ExaoneProcessingResult, MisoHandoffPayload } from "@phone-claw/storage";
import { getWorkspaceRoot, type StoredVoiceSessionDetail } from "@phone-claw/storage";

type ModelJson = {
  summary?: unknown;
  urgency?: unknown;
  requiredTeams?: unknown;
  actionItems?: unknown;
  openQuestions?: unknown;
  reviewReason?: unknown;
};

const DEFAULT_TIMEOUT_MS = 75_000;
const MAX_TRANSCRIPT_CHARS = 5_500;
const DEFAULT_MODEL_PATH = path.join(
  getWorkspaceRoot(),
  "models",
  "exaone",
  "EXAONE-4.0-1.2B-Q4_K_M.gguf"
);

export async function processSessionWithLocalExaone(
  session: StoredVoiceSessionDetail
): Promise<ExaoneProcessingResult> {
  const modelPath = process.env.PHONE_CLAW_EXAONE_MODEL_PATH ?? DEFAULT_MODEL_PATH;
  const transcript = session.transcript.rawText.trim();

  if (!transcript) {
    return buildFallbackResult({
      transcript,
      modelPath,
      modelAvailable: false,
      reviewReason: "전사문이 비어 있어 로컬 규칙 기반 결과를 생성했습니다."
    });
  }

  const modelAvailable = await fileExists(modelPath);
  if (!modelAvailable) {
    return buildFallbackResult({
      transcript,
      modelPath,
      modelAvailable: false,
      reviewReason: "EXAONE GGUF 모델 파일을 찾지 못해 로컬 규칙 기반 결과를 생성했습니다."
    });
  }

  try {
    const rawOutput = await runLlamaCli({
      modelPath,
      prompt: buildPrompt(session),
      timeoutMs: Number(process.env.PHONE_CLAW_EXAONE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
    });
    const parsed = normalizeModelJson(extractJsonObject(rawOutput));

    return {
      schemaVersion: "phone-claw.exaone.local-output.v0",
      processedAt: new Date().toISOString(),
      engine: "exaone-local",
      modelPath,
      modelAvailable: true,
      summary: parsed.summary,
      urgency: parsed.urgency,
      requiredTeams: parsed.requiredTeams,
      actionItems: parsed.actionItems,
      openQuestions: parsed.openQuestions,
      humanReviewRequired: true,
      reviewReason: parsed.reviewReason
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return buildFallbackResult({
      transcript,
      modelPath,
      modelAvailable: true,
      reviewReason: `EXAONE 실행 또는 JSON 파싱이 실패해 로컬 규칙 기반 결과를 생성했습니다: ${message}`
    });
  }
}

function buildPrompt(session: StoredVoiceSessionDetail): string {
  const transcript = session.transcript.rawText.slice(0, MAX_TRANSCRIPT_CHARS);

  return [
    "너는 개인정보가 포함될 수 있는 고객 통화 전사문을 로컬에서만 후처리하는 Voice AI다.",
    "아래 전사문을 읽고 MISO 같은 업무 에이전트가 읽기 쉬운 JSON 한 개만 출력한다.",
    "원문 전사문을 그대로 복사하지 말고 요약한다. 전화번호, 이메일, 긴 숫자, 주민번호처럼 보이는 값은 그대로 쓰지 않는다.",
    "반드시 다음 JSON 스키마만 출력한다:",
    '{"summary":"string","urgency":"unknown|low|normal|high|critical","requiredTeams":["string"],"actionItems":[{"text":"string","owner":null,"status":"open"}],"openQuestions":["string"],"reviewReason":"string"}',
    "",
    `세션 ID: ${session.sessionId}`,
    `통화 방향: ${session.metadata.callDirection ?? "unknown"}`,
    "전사문:",
    transcript
  ].join("\n");
}

async function runLlamaCli(args: {
  modelPath: string;
  prompt: string;
  timeoutMs: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PHONE_CLAW_LLAMA_CLI ?? "llama-cli",
      [
        "-m",
        args.modelPath,
        "-p",
        args.prompt,
        "-n",
        "512",
        "--temp",
        "0.1",
        "--no-display-prompt",
        "--no-show-timings",
        "--simple-io",
        "-st"
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("exaone_timeout"));
    }, args.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`llama_cli_exit_${code}:${stderr.slice(0, 240)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function extractJsonObject(rawOutput: string): ModelJson {
  const fenced = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], rawOutput].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const parsed = collectJsonObjects(candidate);
    const matching = parsed.filter(isModelJsonCandidate);
    if (matching.length > 0) return matching.at(-1) as ModelJson;
    if (parsed.length > 0) return parsed.at(-1) as ModelJson;
  }

  throw new Error("json_object_not_found");
}

function isModelJsonCandidate(value: ModelJson): boolean {
  return (
    typeof value.summary === "string" ||
    Array.isArray(value.actionItems) ||
    Array.isArray(value.openQuestions)
  );
}

function collectJsonObjects(candidate: string): ModelJson[] {
  const objects: ModelJson[] = [];

  for (let start = 0; start < candidate.length; start += 1) {
    if (candidate[start] !== "{") continue;
    const end = findJsonObjectEnd(candidate, start);
    if (end == null) continue;
    try {
      objects.push(JSON.parse(candidate.slice(start, end + 1)) as ModelJson);
    } catch {
      // Keep scanning; llama.cpp may echo prompt fragments before the answer.
    }
  }

  return objects;
}

function findJsonObjectEnd(candidate: string, start: number): number | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < candidate.length; index += 1) {
    const char = candidate[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return index;
  }

  return undefined;
}

function normalizeModelJson(value: ModelJson): Required<ModelJson> & {
  summary: string;
  urgency: MisoHandoffPayload["urgency"];
  requiredTeams: string[];
  actionItems: ExaoneProcessingResult["actionItems"];
  openQuestions: string[];
  reviewReason: string;
} {
  const summary =
    typeof value.summary === "string" && value.summary.trim()
      ? value.summary.trim()
      : "전사문에서 핵심 요청을 추출하지 못했습니다. 사람이 원문을 확인해야 합니다.";

  const urgency = normalizeUrgency(value.urgency);
  const requiredTeams = toStringArray(value.requiredTeams);
  const actionItems = normalizeActionItems(value.actionItems);
  const openQuestions = toStringArray(value.openQuestions);

  return {
    summary,
    urgency,
    requiredTeams,
    actionItems,
    openQuestions,
    reviewReason:
      typeof value.reviewReason === "string" && value.reviewReason.trim()
        ? value.reviewReason.trim()
        : "외부 워크플로우 전달 전 사람이 요약과 액션아이템을 확인해야 합니다."
  };
}

function buildFallbackResult(args: {
  transcript: string;
  modelPath: string;
  modelAvailable: boolean;
  reviewReason: string;
}): ExaoneProcessingResult {
  const lines = args.transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "전사문이 비어 있습니다.";
  const actionCandidates = lines.filter((line) =>
    /(확인|요청|처리|보내|전달|예약|취소|변경|해야|부탁)/.test(line)
  );

  return {
    schemaVersion: "phone-claw.exaone.local-output.v0",
    processedAt: new Date().toISOString(),
    engine: "fallback-local",
    modelPath: args.modelPath,
    modelAvailable: args.modelAvailable,
    summary: summarizeFallback(firstLine),
    urgency: inferUrgency(args.transcript),
    requiredTeams: inferTeams(args.transcript),
    actionItems: (actionCandidates.length > 0 ? actionCandidates : lines.slice(0, 1))
      .slice(0, 3)
      .map((text) => ({
        text: summarizeFallback(text, 140),
        owner: null,
        status: "open"
      })),
    openQuestions: [],
    humanReviewRequired: true,
    reviewReason: args.reviewReason
  };
}

function summarizeFallback(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function inferUrgency(text: string): MisoHandoffPayload["urgency"] {
  if (/(긴급|장애|오류|환불|컴플레인|불만|당장|오늘까지)/.test(text)) return "high";
  if (/(오늘|내일|빠르게|급해)/.test(text)) return "normal";
  return "unknown";
}

function inferTeams(text: string): string[] {
  const teams = new Set<string>();
  if (/(결제|환불|영수증|청구|요금)/.test(text)) teams.add("billing");
  if (/(오류|버그|장애|접속|로그인|앱)/.test(text)) teams.add("support");
  if (/(예약|일정|변경|취소)/.test(text)) teams.add("operations");
  return [...teams];
}

function normalizeUrgency(value: unknown): MisoHandoffPayload["urgency"] {
  return value === "low" ||
    value === "normal" ||
    value === "high" ||
    value === "critical" ||
    value === "unknown"
    ? value
    : "unknown";
}

function normalizeActionItems(value: unknown): ExaoneProcessingResult["actionItems"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ExaoneProcessingResult["actionItems"][number] | undefined => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
      const record = item as Record<string, unknown>;
      if (typeof record.text !== "string" || !record.text.trim()) return undefined;
      const status: ExaoneProcessingResult["actionItems"][number]["status"] =
        record.status === "done" || record.status === "blocked" || record.status === "open"
          ? record.status
          : "open";
      return {
        text: record.text.trim(),
        owner: typeof record.owner === "string" ? record.owner : null,
        status
      };
    })
    .filter((item): item is ExaoneProcessingResult["actionItems"][number] => Boolean(item));
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
