import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  transcriptToMarkdown,
  type ChannelTalkN8nPayload,
  type IngestResult
} from "@phone-claw/core";
import { getStorageDir } from "./config";

type DedupeIndexEntry = {
  sessionId: string;
  payloadHash: string;
  updatedAt: string;
  version: number;
};

type DedupeIndex = Record<string, DedupeIndexEntry>;

type IngestChannelTalkResult = {
  result: IngestResult;
  sessionId: string;
  dedupeKey: string;
  storageDir: string;
  sessionPath: string;
};

export type StoredVoiceSession = {
  sessionId: string;
  status: string;
  source: string;
  mode: string;
  sourceStartedAt: string;
  sourceEndedAt: string | null;
  createdAt: string;
  transcriptPreview: string;
  utteranceCount: number;
  channelId?: string;
  userChatId?: string;
  callDirection?: string;
};

export async function ingestChannelTalkPayload(
  payload: ChannelTalkN8nPayload
): Promise<IngestChannelTalkResult> {
  const storageDir = getStorageDir();
  const sessionsRoot = path.join(storageDir, "sessions");
  const indexPath = path.join(storageDir, ".phone-claw-index", "channel-talk-dedupe.json");

  await mkdir(path.dirname(indexPath), { recursive: true });
  await mkdir(sessionsRoot, { recursive: true });

  const dedupeKey = buildDedupeKey(payload);
  const payloadHash = hashJson(payload);
  const index = await readDedupeIndex(indexPath);
  const existing = index[dedupeKey];

  if (existing && existing.payloadHash === payloadHash) {
    return {
      result: "duplicate",
      sessionId: existing.sessionId,
      dedupeKey,
      storageDir,
      sessionPath: path.join(sessionsRoot, existing.sessionId)
    };
  }

  const result = determineResult(payload, Boolean(existing));
  const sessionId = existing?.sessionId ?? createSessionId(payload);
  const sessionPath = path.join(sessionsRoot, sessionId);
  const version = existing ? existing.version + 1 : 1;

  await writeSessionFiles({
    payload,
    payloadHash,
    result,
    sessionPath,
    dedupeKey,
    version
  });

  index[dedupeKey] = {
    sessionId,
    payloadHash,
    updatedAt: new Date().toISOString(),
    version
  };
  await writeJson(indexPath, index);

  return {
    result,
    sessionId,
    dedupeKey,
    storageDir,
    sessionPath
  };
}

export function buildDedupeKey(payload: ChannelTalkN8nPayload): string {
  if (payload.callLogId) {
    return [payload.channelId, payload.callLogId].join(":");
  }

  if (payload.meetMessageId) {
    return [payload.channelId, payload.userChatId, payload.meetMessageId].join(":");
  }

  return [
    payload.channelId,
    payload.userChatId,
    payload.startedAt,
    payload.endedAt ?? "open"
  ].join(":");
}

export async function listStoredVoiceSessions(): Promise<StoredVoiceSession[]> {
  const storageDir = getStorageDir();
  const sessionsRoot = path.join(storageDir, "sessions");

  let sessionIds: string[];
  try {
    sessionIds = await readdir(sessionsRoot);
  } catch {
    return [];
  }

  const sessions = await Promise.all(
    sessionIds.map(async (sessionId) => readStoredVoiceSession(sessionsRoot, sessionId))
  );

  return sessions
    .filter((session): session is StoredVoiceSession => Boolean(session))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function readStoredVoiceSession(
  sessionsRoot: string,
  sessionId: string
): Promise<StoredVoiceSession | undefined> {
  const sessionPath = path.join(sessionsRoot, sessionId);

  try {
    const [metadata, agentDraft] = await Promise.all([
      readJson(path.join(sessionPath, "metadata.json")),
      readJson(path.join(sessionPath, "agent", "voice-session-draft.json"))
    ]);
    const rawText = getString(agentDraft, ["transcript", "rawText"]) ?? "";
    const utterances = getArray(agentDraft, ["transcript", "utterances"]);

    return {
      sessionId,
      status: getString(metadata, ["status"]) ?? "unknown",
      source: getString(metadata, ["source"]) ?? "unknown",
      mode: getString(metadata, ["mode"]) ?? "unknown",
      sourceStartedAt: getString(metadata, ["sourceStartedAt"]) ?? "",
      sourceEndedAt: getNullableString(metadata, ["sourceEndedAt"]),
      createdAt: getString(metadata, ["createdAt"]) ?? "",
      transcriptPreview: rawText.split("\n").join(" ").slice(0, 180),
      utteranceCount: utterances?.length ?? 0,
      channelId: getString(agentDraft, ["metadata", "channelId"]),
      userChatId: getString(agentDraft, ["metadata", "userChatId"]),
      callDirection: getString(agentDraft, ["metadata", "callDirection"])
    };
  } catch {
    return undefined;
  }
}

function determineResult(payload: ChannelTalkN8nPayload, isUpdate: boolean): IngestResult {
  if (isUpdate) return "updated";
  if (payload.status === "fallback_pending") return "fallback_pending";
  if (payload.transcript.length === 0 || payload.status === "skipped_no_transcript") {
    return "skipped_no_transcript";
  }
  return "created";
}

async function writeSessionFiles(args: {
  payload: ChannelTalkN8nPayload;
  payloadHash: string;
  result: IngestResult;
  sessionPath: string;
  dedupeKey: string;
  version: number;
}) {
  const { payload, payloadHash, result, sessionPath, dedupeKey, version } = args;

  await mkdir(path.join(sessionPath, "source"), { recursive: true });
  await mkdir(path.join(sessionPath, "transcript"), { recursive: true });
  await mkdir(path.join(sessionPath, "agent"), { recursive: true });
  await mkdir(path.join(sessionPath, "review"), { recursive: true });
  await mkdir(path.join(sessionPath, "handoff"), { recursive: true });

  const status =
    result === "skipped_no_transcript" || result === "fallback_pending"
      ? result
      : "pending_processing";
  const metadata = {
    sessionId: path.basename(sessionPath),
    source: "channel_talk_n8n",
    mode: payload.mode,
    status,
    reason:
      payload.reason ??
      (status === "pending_processing"
        ? "transcript_ingested_before_exaone_pipeline_ready"
        : undefined),
    sensitivity: "external",
    dedupeKey,
    payloadHash,
    createdAt: new Date().toISOString(),
    sourceStartedAt: payload.startedAt,
    sourceEndedAt: payload.endedAt ?? null
  };

  await writeJson(path.join(sessionPath, "metadata.json"), metadata);
  await writeJson(path.join(sessionPath, "source", "channel-talk.payload.json"), payload);
  if (version > 1) {
    await writeJson(
      path.join(sessionPath, "source", `channel-talk.payload.v${version}.json`),
      payload
    );
  }

  const transcriptMarkdown = transcriptToMarkdown(payload);
  await writeFile(
    path.join(sessionPath, "source", "channel-transcript.raw.md"),
    transcriptMarkdown,
    "utf8"
  );
  await writeFile(
    path.join(sessionPath, "transcript", "transcript.raw.md"),
    transcriptMarkdown,
    "utf8"
  );

  await writeJson(path.join(sessionPath, "agent", "voice-session-draft.json"), {
    sessionId: path.basename(sessionPath),
    source: "channel_talk_n8n",
    mode: payload.mode,
    sensitivity: "external",
    transcript: {
      rawText: payload.transcript.map((item) => item.text).join("\n"),
      utterances: payload.transcript
    },
    metadata: {
      channelId: payload.channelId,
      userChatId: payload.userChatId,
      meetMessageId: payload.meetMessageId ?? null,
      callLogId: payload.callLogId ?? null,
      callDirection: payload.callDirection,
      participants: payload.participants,
      recordingUrl: payload.recordingUrl ?? null
    }
  });

  await writeJson(path.join(sessionPath, "review", "review-state.json"), {
    reviewed: false,
    externalAllowed: false
  });
}

function createSessionId(payload: ChannelTalkN8nPayload): string {
  const timestamp = payload.startedAt
    .replaceAll(":", "")
    .replaceAll("-", "")
    .replace(/\.\d+/, "")
    .replace("+", "_")
    .replace("Z", "_utc");
  const suffix = shortHash(buildDedupeKey(payload));
  return `${timestamp}_channel_talk_${suffix}`;
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

async function readDedupeIndex(indexPath: string): Promise<DedupeIndex> {
  try {
    const raw = await readFile(indexPath, "utf8");
    return JSON.parse(raw) as DedupeIndex;
  } catch {
    return {};
  }
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function getString(value: unknown, keys: string[]): string | undefined {
  const found = getNestedValue(value, keys);
  return typeof found === "string" ? found : undefined;
}

function getNullableString(value: unknown, keys: string[]): string | null {
  const found = getNestedValue(value, keys);
  return typeof found === "string" ? found : null;
}

function getArray(value: unknown, keys: string[]): unknown[] | undefined {
  const found = getNestedValue(value, keys);
  return Array.isArray(found) ? found : undefined;
}

function getNestedValue(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
