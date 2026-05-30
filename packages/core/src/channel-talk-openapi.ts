import {
  channelTalkN8nPayloadSchema,
  type ChannelTalkN8nPayload,
  type TranscriptUtterance
} from "./schemas/channel-talk";

type RecordLike = Record<string, unknown>;

export function normalizeChannelTalkOpenApiPayload(raw: unknown): ChannelTalkN8nPayload {
  const envelope = unwrapEmptyKeyWrapper(asRecord(parseJsonString(raw)) ?? {});
  const body = asRecord(parseJsonString(envelope.body));
  const root = shouldUseWebhookBody(body) ? body : envelope;
  const webhookEvent = asRecord(root.webhookEvent) ?? (isWebhookEventRoot(root) ? root : body);
  const entity = asRecord(webhookEvent?.entity) ?? asRecord(root.entity);
  const refers = asRecord(root.refers) ?? asRecord(webhookEvent?.refers);
  const userChat =
    asRecord(root.userChat) ??
    asRecord(asRecord(root.userChatResponse)?.userChat) ??
    asRecord(refers?.userChat) ??
    (webhookEvent?.type === "userChat" ? entity : undefined);
  const messages = extractMessages(root, webhookEvent, entity);

  const channelId =
    getString(root, "channelId") ??
    getString(userChat, "channelId") ??
    getString(entity, "channelId") ??
    getString(messages[0], "channelId");
  const userChatId =
    getString(root, "userChatId") ??
    getString(userChat, "id") ??
    getString(entity, "chatId") ??
    getString(entity, "id") ??
    getString(messages[0], "chatId");

  if (!channelId || !userChatId) {
    throw new Error("channel_talk_openapi_missing_channel_or_user_chat_id");
  }

  const messageTimes = messages.map((message) => getNumber(message, "createdAt")).filter(isNumber);
  const firstMessageAt = messageTimes.length > 0 ? Math.min(...messageTimes) : undefined;
  const startedMs =
    getNumber(root, "startedAt") ??
    getNumber(userChat, "openedAt") ??
    getNumber(userChat, "createdAt") ??
    getNumber(userChat, "firstOpenedAt") ??
    firstMessageAt ??
    Date.now();
  const endedMs = getEndedAtMs(root, userChat, messages);
  const transcript = buildTranscript(messages, startedMs);
  const status =
    transcript.length === 0 ? "skipped_no_transcript" : getStatus(root) ?? "ready";

  const payload = {
    source: "channel_talk_n8n",
    status,
    reason:
      getString(root, "reason") ??
      (transcript.length === 0 ? "channel_talk_openapi_no_text_messages" : undefined),
    mode: "call",
    channelId,
    userChatId,
    meetMessageId:
      getString(root, "meetMessageId") ??
      (webhookEvent?.type === "message" ? getString(entity, "id") : undefined),
    callLogId: getString(root, "callLogId"),
    callDirection: getCallDirection(messages),
    startedAt: toIso(startedMs),
    endedAt: endedMs == null ? undefined : toIso(endedMs),
    participants: buildParticipants(userChat, messages),
    transcript,
    recordingUrl: getString(root, "recordingUrl") ?? null,
    rawEvent: raw
  };

  return channelTalkN8nPayloadSchema.parse(payload);
}

function parseJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function unwrapEmptyKeyWrapper(value: RecordLike): RecordLike {
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "") return value;
  return asRecord(parseJsonString(value[""])) ?? value;
}

function shouldUseWebhookBody(body: RecordLike | undefined): body is RecordLike {
  if (!body) return false;
  return Boolean(
    body.source ||
      body.userChat ||
      body.userChatResponse ||
      body.messages ||
      body.messagesResponse ||
      body.webhookEvent ||
      body.entity ||
      body.channelId ||
      body.userChatId
  );
}

function isWebhookEventRoot(value: RecordLike): boolean {
  return Boolean(value.entity && (value.type || value.event));
}

function extractMessages(
  root: RecordLike,
  webhookEvent?: RecordLike,
  entity?: RecordLike
): RecordLike[] {
  const candidates = [
    root.messages,
    asRecord(root.messagesResponse)?.messages,
    asRecord(root.data)?.messages
  ];
  const messages = candidates.flatMap((candidate) => asArray(candidate).flatMap(toRecordArray));

  if (webhookEvent?.type === "message" && entity) {
    messages.push(entity);
  }

  return messages;
}

function buildTranscript(messages: RecordLike[], startedMs: number): TranscriptUtterance[] {
  const transcript: TranscriptUtterance[] = [];

  for (const message of messages) {
    const text = getMessageText(message);
    if (!text) continue;

    const createdAt = getNumber(message, "createdAt");
    const utterance: TranscriptUtterance = {
      speaker: getSpeaker(message),
      text
    };

    if (createdAt != null) {
      utterance.timestampMs = Math.max(0, Math.round(createdAt - startedMs));
    }

    transcript.push(utterance);
  }

  return transcript.sort(
    (left, right) =>
      (left.timestampMs ?? Number.MAX_SAFE_INTEGER) -
      (right.timestampMs ?? Number.MAX_SAFE_INTEGER)
  );
}

function getMessageText(message: RecordLike): string | undefined {
  const plainText = getString(message, "plainText");
  if (plainText?.trim()) return plainText.trim();

  const blockTexts = collectBlockText(asArray(message.blocks));
  const text = blockTexts.join("\n").trim();
  return text.length > 0 ? text : undefined;
}

function collectBlockText(blocks: unknown[]): string[] {
  const texts: string[] = [];
  for (const block of blocks) {
    const record = asRecord(block);
    if (!record) continue;
    const value = getString(record, "value");
    if (value?.trim()) texts.push(value.trim());
    texts.push(...collectBlockText(asArray(record.blocks)));
  }
  return texts;
}

function getSpeaker(message: RecordLike): string {
  const personType = getString(message, "personType") ?? "unknown";
  const personId = getString(message, "personId");
  return personId ? `${personType}:${personId}` : personType;
}

function buildParticipants(userChat: RecordLike | undefined, messages: RecordLike[]) {
  const participants = new Map<string, { id: string; role: "counterparty" | "user" | "manager" | "bot" | "unknown"; displayName?: string }>();

  const userId = getString(userChat, "userId");
  if (userId) {
    participants.set(`user:${userId}`, {
      id: userId,
      role: "counterparty",
      displayName: getString(userChat, "name")
    });
  }

  for (const message of messages) {
    const personType = getString(message, "personType") ?? "unknown";
    const personId = getString(message, "personId") ?? personType;
    const id = `${personType}:${personId}`;
    if (participants.has(id)) continue;
    participants.set(id, {
      id,
      role: mapParticipantRole(personType),
      displayName:
        getString(asRecord(message.profile), "name") ??
        getString(asRecord(message.person), "name")
    });
  }

  if (participants.size === 0) {
    participants.set("unknown", { id: "unknown", role: "unknown" });
  }

  return [...participants.values()];
}

function mapParticipantRole(personType: string) {
  if (personType === "user") return "counterparty" as const;
  if (personType === "manager") return "user" as const;
  if (personType === "bot") return "bot" as const;
  return "unknown" as const;
}

function getCallDirection(messages: RecordLike[]) {
  const firstSpeaker = messages
    .map((message) => getString(message, "personType"))
    .find((personType) => Boolean(personType));
  if (firstSpeaker === "user") return "inbound" as const;
  if (firstSpeaker === "manager" || firstSpeaker === "bot") return "outbound" as const;
  return "unknown" as const;
}

function getEndedAtMs(
  root: RecordLike,
  userChat: RecordLike | undefined,
  messages: RecordLike[]
): number | undefined {
  const explicit = getNumber(root, "endedAt");
  if (explicit != null) return explicit;

  if (getString(userChat, "state") !== "closed") return undefined;
  return (
    getNumber(userChat, "closedAt") ??
    getNumber(userChat, "updatedAt") ??
    messages.map((message) => getNumber(message, "createdAt")).filter(isNumber).at(-1)
  );
}

function getStatus(root: RecordLike) {
  const status = getString(root, "status");
  if (
    status === "ready" ||
    status === "pending_processing" ||
    status === "skipped_no_transcript" ||
    status === "fallback_pending"
  ) {
    return status;
  }
  return undefined;
}

function toIso(value: number | string): string {
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date(value).toISOString();
}

function asRecord(value: unknown): RecordLike | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordLike)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toRecordArray(value: unknown): RecordLike[] {
  const record = asRecord(value);
  return record ? [record] : [];
}

function getString(record: RecordLike | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(record: RecordLike | undefined, key: string): number | undefined {
  const value = record?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }
  return undefined;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === "number";
}
