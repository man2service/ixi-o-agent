import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  transcriptToMarkdown,
  type ChannelTalkN8nPayload,
  type IngestResult,
  type TranscriptUtterance
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
  exaoneProcessed: boolean;
  review: {
    reviewed: boolean;
    externalAllowed: boolean;
  };
};

export type VoiceSessionReviewState = {
  reviewed: boolean;
  externalAllowed: boolean;
  reviewedAt?: string;
  reviewer?: string;
  note?: string;
};

export type ExaoneActionItem = {
  text: string;
  owner: string | null;
  status?: "open" | "done" | "blocked";
};

export type ExaoneProcessingResult = {
  schemaVersion: "phone-claw.exaone.local-output.v0";
  processedAt: string;
  engine: "exaone-local" | "fallback-local";
  modelPath: string | null;
  modelAvailable: boolean;
  summary: string;
  urgency: MisoHandoffPayload["urgency"];
  requiredTeams: string[];
  actionItems: ExaoneActionItem[];
  openQuestions: string[];
  humanReviewRequired: true;
  reviewReason: string;
  rawModelOutput?: string;
};

export type StoredVoiceSessionDetail = StoredVoiceSession & {
  metadata: {
    channelId?: string;
    userChatId?: string;
    callLogId?: string | null;
    meetMessageId?: string | null;
    callDirection?: string;
    participants: unknown[];
    recordingUrl?: string | null;
  };
  transcript: {
    rawText: string;
    utterances: TranscriptUtterance[];
  };
  review: VoiceSessionReviewState;
  exaone?: ExaoneProcessingResult;
  handoff?: MisoHandoffPayload;
  files: {
    sessionPath: string;
    rawTranscript: string;
    agentDraft: string;
    exaoneOutput: string;
    reviewState: string;
    misoPayload: string;
  };
};

export type MisoVoiceSessionSummary = {
  sessionId: string;
  status: string;
  source: string;
  mode: string;
  sourceStartedAt: string;
  sourceEndedAt: string | null;
  createdAt: string;
  utteranceCount: number;
  review: {
    reviewed: boolean;
    externalAllowed: boolean;
  };
  safety: {
    redactionApplied: true;
    rawTranscriptIncluded: false;
    rawAudioIncluded: false;
    humanReviewRequired: true;
  };
};

export type MisoVoiceSessionDetail = MisoVoiceSessionSummary & {
  handoff: {
    availableForExternalWorkflow: boolean;
    blockedReason?: string;
    redactedPayload?: MisoHandoffPayload;
  };
};

export type MisoHandoffPayload = {
  schemaVersion: "phone-claw.miso.voice-session.v0";
  eventType: "voice-session.created";
  source: "phone-claw-private-local-voice-bridge";
  sourceSystem: "channel_talk" | "local_voice";
  sourceMode: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  summary: string;
  urgency: "unknown" | "low" | "normal" | "high" | "critical";
  requiredTeams: string[];
  actionItems: Array<{
    text: string;
    owner: string | null;
    status: "open" | "done" | "blocked";
  }>;
  redactionApplied: true;
  humanReviewRequired: true;
  rawTranscriptIncluded: false;
  rawAudioIncluded: false;
  reviewStatus: "pending_human_review" | "approved_for_external_workflow";
  sourceRefs: {
    channelId: string;
    userChatId: string;
    callLogId: string | null;
    meetMessageId: string | null;
  };
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

export async function listMisoVoiceSessions(): Promise<MisoVoiceSessionSummary[]> {
  const storageDir = getStorageDir();
  const sessionsRoot = path.join(storageDir, "sessions");

  let sessionIds: string[];
  try {
    sessionIds = await readdir(sessionsRoot);
  } catch {
    return [];
  }

  const sessions = await Promise.all(
    sessionIds.map(async (sessionId) => readMisoVoiceSessionSummary(sessionsRoot, sessionId))
  );

  return sessions
    .filter((session): session is MisoVoiceSessionSummary => Boolean(session))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readMisoVoiceSession(
  sessionId: string
): Promise<MisoVoiceSessionDetail | undefined> {
  if (!isSafeSessionId(sessionId)) return undefined;

  const storageDir = getStorageDir();
  const sessionsRoot = path.join(storageDir, "sessions");
  const summary = await readMisoVoiceSessionSummary(sessionsRoot, sessionId);
  if (!summary) return undefined;

  const sessionPath = path.join(sessionsRoot, sessionId);
  const redactedPayload = (await readOptionalJson(
    path.join(sessionPath, "handoff", "miso-payload.redacted.json")
  )) as MisoHandoffPayload | undefined;
  const availableForExternalWorkflow =
    summary.review.reviewed && summary.review.externalAllowed && Boolean(redactedPayload);

  return {
    ...summary,
    handoff: {
      availableForExternalWorkflow,
      blockedReason: availableForExternalWorkflow
        ? undefined
        : "human_review_required_before_miso_handoff",
      redactedPayload: availableForExternalWorkflow ? redactedPayload : undefined
    }
  };
}

export async function readStoredVoiceSessionDetail(
  sessionId: string
): Promise<StoredVoiceSessionDetail | undefined> {
  if (!isSafeSessionId(sessionId)) return undefined;

  const storageDir = getStorageDir();
  const sessionsRoot = path.join(storageDir, "sessions");
  const summary = await readStoredVoiceSession(sessionsRoot, sessionId);
  if (!summary) return undefined;

  const sessionPath = path.join(sessionsRoot, sessionId);
  const [agentDraft, reviewState, exaoneOutput, handoffPayload] = await Promise.all([
    readJson(path.join(sessionPath, "agent", "voice-session-draft.json")),
    readOptionalJson(path.join(sessionPath, "review", "review-state.json")),
    readOptionalJson(path.join(sessionPath, "agent", "exaone.local-output.json")),
    readOptionalJson(path.join(sessionPath, "handoff", "miso-payload.redacted.json"))
  ]);

  const utterances = getArray(agentDraft, ["transcript", "utterances"]) ?? [];

  return {
    ...summary,
    metadata: {
      channelId: getString(agentDraft, ["metadata", "channelId"]),
      userChatId: getString(agentDraft, ["metadata", "userChatId"]),
      callLogId: getNullableString(agentDraft, ["metadata", "callLogId"]),
      meetMessageId: getNullableString(agentDraft, ["metadata", "meetMessageId"]),
      callDirection: getString(agentDraft, ["metadata", "callDirection"]),
      participants: getArray(agentDraft, ["metadata", "participants"]) ?? [],
      recordingUrl: getNullableString(agentDraft, ["metadata", "recordingUrl"])
    },
    transcript: {
      rawText: getString(agentDraft, ["transcript", "rawText"]) ?? "",
      utterances: utterances as TranscriptUtterance[]
    },
    review: normalizeReviewState(reviewState),
    exaone: normalizeExaoneResult(exaoneOutput),
    handoff: normalizeMisoHandoffPayload(handoffPayload),
    files: {
      sessionPath,
      rawTranscript: path.join(sessionPath, "transcript", "transcript.raw.md"),
      agentDraft: path.join(sessionPath, "agent", "voice-session-draft.json"),
      exaoneOutput: path.join(sessionPath, "agent", "exaone.local-output.json"),
      reviewState: path.join(sessionPath, "review", "review-state.json"),
      misoPayload: path.join(sessionPath, "handoff", "miso-payload.redacted.json")
    }
  };
}

export async function writeExaoneProcessingResult(
  sessionId: string,
  result: ExaoneProcessingResult
): Promise<StoredVoiceSessionDetail> {
  if (!isSafeSessionId(sessionId)) {
    throw new Error("invalid_session_id");
  }

  const sessionPath = getSessionPath(sessionId);
  const metadataPath = path.join(sessionPath, "metadata.json");
  const agentDraftPath = path.join(sessionPath, "agent", "voice-session-draft.json");
  const [metadata, agentDraft, reviewState] = await Promise.all([
    readJson(metadataPath),
    readJson(agentDraftPath),
    readOptionalJson(path.join(sessionPath, "review", "review-state.json"))
  ]);

  const normalizedResult: ExaoneProcessingResult = {
    ...result,
    schemaVersion: "phone-claw.exaone.local-output.v0",
    processedAt: result.processedAt || new Date().toISOString(),
    humanReviewRequired: true
  };
  const review = normalizeReviewState(reviewState);

  await writeJson(path.join(sessionPath, "agent", "exaone.local-output.json"), normalizedResult);

  const nextAgentDraft = {
    ...(isRecord(agentDraft) ? agentDraft : {}),
    postProcessing: {
      engine: normalizedResult.engine,
      modelPath: normalizedResult.modelPath,
      processedAt: normalizedResult.processedAt,
      outputFile: "agent/exaone.local-output.json"
    }
  };
  await writeJson(agentDraftPath, nextAgentDraft);

  const nextMetadata = {
    ...(isRecord(metadata) ? metadata : {}),
    status:
      review.reviewed && review.externalAllowed
        ? "approved_for_external_workflow"
        : "processed_pending_review",
    processedAt: normalizedResult.processedAt
  };
  await writeJson(metadataPath, nextMetadata);

  const reviewStatus =
    review.reviewed && review.externalAllowed
      ? "approved_for_external_workflow"
      : "pending_human_review";
  const handoffPayload = buildMisoHandoffPayloadFromProcessed({
    agentDraft: nextAgentDraft,
    metadata: nextMetadata,
    result: normalizedResult,
    reviewStatus,
    sessionId
  });
  await writeMisoHandoffFiles(sessionPath, handoffPayload);

  const detail = await readStoredVoiceSessionDetail(sessionId);
  if (!detail) throw new Error("session_not_found_after_processing");
  return detail;
}

export async function updateVoiceSessionReview(
  sessionId: string,
  input: {
    externalAllowed: boolean;
    reviewed?: boolean;
    reviewer?: string;
    note?: string;
  }
): Promise<StoredVoiceSessionDetail> {
  if (!isSafeSessionId(sessionId)) {
    throw new Error("invalid_session_id");
  }

  const sessionPath = getSessionPath(sessionId);
  const reviewed = input.reviewed ?? true;
  const reviewState: VoiceSessionReviewState = {
    reviewed,
    externalAllowed: reviewed ? input.externalAllowed : false,
    reviewedAt: new Date().toISOString(),
    reviewer: input.reviewer ?? "local_demo_operator",
    note: input.note
  };

  await writeJson(path.join(sessionPath, "review", "review-state.json"), reviewState);

  const handoffPayload = normalizeMisoHandoffPayload(
    await readOptionalJson(path.join(sessionPath, "handoff", "miso-payload.redacted.json"))
  );
  if (handoffPayload) {
    await writeMisoHandoffFiles(sessionPath, {
      ...handoffPayload,
      reviewStatus:
        reviewState.reviewed && reviewState.externalAllowed
          ? "approved_for_external_workflow"
          : "pending_human_review"
    });
  }

  const metadataPath = path.join(sessionPath, "metadata.json");
  const metadata = await readJson(metadataPath);
  if (isRecord(metadata)) {
    await writeJson(metadataPath, {
      ...metadata,
      status:
        reviewState.reviewed && reviewState.externalAllowed
          ? "approved_for_external_workflow"
          : getString(metadata, ["processedAt"])
            ? "processed_pending_review"
            : metadata.status
    });
  }

  const detail = await readStoredVoiceSessionDetail(sessionId);
  if (!detail) throw new Error("session_not_found_after_review");
  return detail;
}

async function readStoredVoiceSession(
  sessionsRoot: string,
  sessionId: string
): Promise<StoredVoiceSession | undefined> {
  const sessionPath = path.join(sessionsRoot, sessionId);

  try {
    const [metadata, agentDraft, reviewState, exaoneOutput] = await Promise.all([
      readJson(path.join(sessionPath, "metadata.json")),
      readJson(path.join(sessionPath, "agent", "voice-session-draft.json")),
      readOptionalJson(path.join(sessionPath, "review", "review-state.json")),
      readOptionalJson(path.join(sessionPath, "agent", "exaone.local-output.json"))
    ]);
    const rawText = getString(agentDraft, ["transcript", "rawText"]) ?? "";
    const utterances = getArray(agentDraft, ["transcript", "utterances"]);
    const review = normalizeReviewState(reviewState);
    const exaone = normalizeExaoneResult(exaoneOutput);

    return {
      sessionId,
      status: deriveSessionStatus(getString(metadata, ["status"]) ?? "unknown", review, exaone),
      source: getString(metadata, ["source"]) ?? "unknown",
      mode: getString(metadata, ["mode"]) ?? "unknown",
      sourceStartedAt: getString(metadata, ["sourceStartedAt"]) ?? "",
      sourceEndedAt: getNullableString(metadata, ["sourceEndedAt"]),
      createdAt: getString(metadata, ["createdAt"]) ?? "",
      transcriptPreview: rawText.split("\n").join(" ").slice(0, 180),
      utteranceCount: utterances?.length ?? 0,
      channelId: getString(agentDraft, ["metadata", "channelId"]),
      userChatId: getString(agentDraft, ["metadata", "userChatId"]),
      callDirection: getString(agentDraft, ["metadata", "callDirection"]),
      exaoneProcessed: Boolean(exaone),
      review: {
        reviewed: review.reviewed,
        externalAllowed: review.externalAllowed
      }
    };
  } catch {
    return undefined;
  }
}

async function readMisoVoiceSessionSummary(
  sessionsRoot: string,
  sessionId: string
): Promise<MisoVoiceSessionSummary | undefined> {
  const sessionPath = path.join(sessionsRoot, sessionId);

  try {
    const [metadata, agentDraft, reviewState, exaoneOutput] = await Promise.all([
      readJson(path.join(sessionPath, "metadata.json")),
      readJson(path.join(sessionPath, "agent", "voice-session-draft.json")),
      readOptionalJson(path.join(sessionPath, "review", "review-state.json")),
      readOptionalJson(path.join(sessionPath, "agent", "exaone.local-output.json"))
    ]);
    const utterances = getArray(agentDraft, ["transcript", "utterances"]);
    const review = normalizeReviewState(reviewState);
    const exaone = normalizeExaoneResult(exaoneOutput);

    return {
      sessionId,
      status: deriveSessionStatus(getString(metadata, ["status"]) ?? "unknown", review, exaone),
      source: getString(metadata, ["source"]) ?? "unknown",
      mode: getString(metadata, ["mode"]) ?? "unknown",
      sourceStartedAt: getString(metadata, ["sourceStartedAt"]) ?? "",
      sourceEndedAt: getNullableString(metadata, ["sourceEndedAt"]),
      createdAt: getString(metadata, ["createdAt"]) ?? "",
      utteranceCount: utterances?.length ?? 0,
      review: {
        reviewed: review.reviewed,
        externalAllowed: review.externalAllowed
      },
      safety: {
        redactionApplied: true,
        rawTranscriptIncluded: false,
        rawAudioIncluded: false,
        humanReviewRequired: true
      }
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
    source: payload.source,
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
    source: payload.source,
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

  const redactedPayload = buildInitialMisoHandoffPayload({
    payload,
    reviewStatus: "pending_human_review",
    sessionId: path.basename(sessionPath)
  });
  await writeMisoHandoffFiles(sessionPath, redactedPayload);
}

function buildInitialMisoHandoffPayload(args: {
  payload: ChannelTalkN8nPayload;
  reviewStatus: MisoHandoffPayload["reviewStatus"];
  sessionId: string;
}): MisoHandoffPayload {
  const { payload, reviewStatus, sessionId } = args;
  const redactedPreview = redactText(toRawText(payload.transcript)).slice(0, 360);

  return {
    schemaVersion: "phone-claw.miso.voice-session.v0",
    eventType: "voice-session.created",
    source: "phone-claw-private-local-voice-bridge",
    sourceSystem: payload.source === "local_voice_upload" ? "local_voice" : "channel_talk",
    sourceMode: payload.mode,
    sessionId,
    startedAt: payload.startedAt,
    endedAt: payload.endedAt ?? null,
    summary:
      redactedPreview.length > 0
        ? `Local processing pending. Redacted transcript preview: ${redactedPreview}`
        : "Local processing pending. No transcript text is available yet.",
    urgency: "unknown",
    requiredTeams: [],
    actionItems: [],
    redactionApplied: true,
    humanReviewRequired: true,
    rawTranscriptIncluded: false,
    rawAudioIncluded: false,
    reviewStatus,
    sourceRefs: {
      channelId: payload.channelId,
      userChatId: payload.userChatId,
      callLogId: payload.callLogId ?? null,
      meetMessageId: payload.meetMessageId ?? null
    }
  };
}

function buildMisoHandoffPayloadFromProcessed(args: {
  agentDraft: Record<string, unknown>;
  metadata: Record<string, unknown>;
  result: ExaoneProcessingResult;
  reviewStatus: MisoHandoffPayload["reviewStatus"];
  sessionId: string;
}): MisoHandoffPayload {
  const { agentDraft, metadata, result, reviewStatus, sessionId } = args;

  return {
    schemaVersion: "phone-claw.miso.voice-session.v0",
    eventType: "voice-session.created",
    source: "phone-claw-private-local-voice-bridge",
    sourceSystem:
      getString(agentDraft, ["source"]) === "local_voice_upload" ? "local_voice" : "channel_talk",
    sourceMode: getString(metadata, ["mode"]) ?? "call",
    sessionId,
    startedAt: getString(metadata, ["sourceStartedAt"]) ?? "",
    endedAt: getNullableString(metadata, ["sourceEndedAt"]),
    summary: redactText(result.summary),
    urgency: result.urgency,
    requiredTeams: result.requiredTeams.map((team) => redactText(team)),
    actionItems: result.actionItems.map((item) => ({
      text: redactText(item.text),
      owner: item.owner ? redactText(item.owner) : null,
      status: item.status ?? "open"
    })),
    redactionApplied: true,
    humanReviewRequired: true,
    rawTranscriptIncluded: false,
    rawAudioIncluded: false,
    reviewStatus,
    sourceRefs: {
      channelId: getString(agentDraft, ["metadata", "channelId"]) ?? "unknown",
      userChatId: getString(agentDraft, ["metadata", "userChatId"]) ?? "unknown",
      callLogId: getNullableString(agentDraft, ["metadata", "callLogId"]),
      meetMessageId: getNullableString(agentDraft, ["metadata", "meetMessageId"])
    }
  };
}

async function writeMisoHandoffFiles(sessionPath: string, payload: MisoHandoffPayload) {
  await writeJson(path.join(sessionPath, "handoff", "miso-payload.redacted.json"), payload);
  await writeJson(path.join(sessionPath, "handoff", "proposed-miso-request.json"), {
    method: "POST",
    path: "/miso/events/voice-session.created",
    note: "Proposed MISO inbound webhook. Current MISO guide supports outbound tools/MCP, so this is a schema proposal unless MISO opens an ingest endpoint.",
    payload
  });
}

function toRawText(transcript: TranscriptUtterance[]): string {
  return transcript.map((item) => item.text).join("\n");
}

function redactText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "[phone]")
    .replace(/\b\d{2,4}-\d{3,4}-\d{4}\b/g, "[phone]")
    .replace(/\b\d{6}-\d{7}\b/g, "[id-number]")
    .replace(/\b\d{13,16}\b/g, "[long-number]");
}

function createSessionId(payload: ChannelTalkN8nPayload): string {
  const timestamp = payload.startedAt
    .replaceAll(":", "")
    .replaceAll("-", "")
    .replace(/\.\d+/, "")
    .replace("+", "_")
    .replace("Z", "_utc");
  const suffix = shortHash(buildDedupeKey(payload));
  const sourceLabel = payload.source === "local_voice_upload" ? "local_voice" : "channel_talk";
  return `${timestamp}_${sourceLabel}_${suffix}`;
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

async function readOptionalJson(filePath: string): Promise<unknown | undefined> {
  try {
    return await readJson(filePath);
  } catch {
    return undefined;
  }
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

function getBoolean(value: unknown, keys: string[]): boolean | undefined {
  const found = getNestedValue(value, keys);
  return typeof found === "boolean" ? found : undefined;
}

function getNestedValue(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function normalizeReviewState(value: unknown): VoiceSessionReviewState {
  return {
    reviewed: getBoolean(value, ["reviewed"]) ?? false,
    externalAllowed: getBoolean(value, ["externalAllowed"]) ?? false,
    reviewedAt: getString(value, ["reviewedAt"]),
    reviewer: getString(value, ["reviewer"]),
    note: getString(value, ["note"])
  };
}

function deriveSessionStatus(
  storedStatus: string,
  review: VoiceSessionReviewState,
  exaone: ExaoneProcessingResult | undefined
): string {
  if (review.reviewed && review.externalAllowed) return "approved_for_external_workflow";
  if (exaone) return "processed_pending_review";
  return storedStatus;
}

function normalizeExaoneResult(value: unknown): ExaoneProcessingResult | undefined {
  if (!isRecord(value)) return undefined;
  const summary = getString(value, ["summary"]);
  if (!summary) return undefined;

  const urgency = getString(value, ["urgency"]);
  const validUrgency: MisoHandoffPayload["urgency"] =
    urgency === "low" ||
    urgency === "normal" ||
    urgency === "high" ||
    urgency === "critical" ||
    urgency === "unknown"
      ? urgency
      : "unknown";

  return {
    schemaVersion: "phone-claw.exaone.local-output.v0",
    processedAt: getString(value, ["processedAt"]) ?? "",
    engine: getString(value, ["engine"]) === "exaone-local" ? "exaone-local" : "fallback-local",
    modelPath: getNullableString(value, ["modelPath"]),
    modelAvailable: getBoolean(value, ["modelAvailable"]) ?? false,
    summary,
    urgency: validUrgency,
    requiredTeams: toStringArray(getArray(value, ["requiredTeams"])),
    actionItems: normalizeActionItems(getArray(value, ["actionItems"])),
    openQuestions: toStringArray(getArray(value, ["openQuestions"])),
    humanReviewRequired: true,
    reviewReason: getString(value, ["reviewReason"]) ?? "human review required before handoff",
    rawModelOutput: getString(value, ["rawModelOutput"])
  };
}

function normalizeMisoHandoffPayload(value: unknown): MisoHandoffPayload | undefined {
  if (!isRecord(value)) return undefined;
  if (getString(value, ["schemaVersion"]) !== "phone-claw.miso.voice-session.v0") {
    return undefined;
  }
  return value as MisoHandoffPayload;
}

function normalizeActionItems(value: unknown[] | undefined): ExaoneActionItem[] {
  if (!value) return [];
  return value
    .map((item): ExaoneActionItem | undefined => {
      if (typeof item === "string") {
        return { text: item, owner: null, status: "open" as const };
      }
      if (!isRecord(item)) return undefined;
      const text = getString(item, ["text"]);
      if (!text) return undefined;
      const status = getString(item, ["status"]);
      const normalizedStatus: ExaoneActionItem["status"] =
        status === "done" || status === "blocked" || status === "open" ? status : "open";
      return {
        text,
        owner: getNullableString(item, ["owner"]),
        status: normalizedStatus
      };
    })
    .filter((item): item is ExaoneActionItem => Boolean(item));
}

function toStringArray(value: unknown[] | undefined): string[] {
  return value?.filter((item): item is string => typeof item === "string") ?? [];
}

function getSessionPath(sessionId: string): string {
  return path.join(getStorageDir(), "sessions", sessionId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_.-]+$/.test(sessionId);
}
