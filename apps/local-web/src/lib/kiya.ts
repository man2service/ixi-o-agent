import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MisoHandoffPayload, StoredVoiceSessionDetail } from "@ixi-o-agent/storage";

export type HermesRecommendation = {
  type: "calendar" | "follow_up" | "review";
  title: string;
  reason: string;
  nextStep: string;
};

export type CalendarProposal = {
  detected: boolean;
  title: string;
  dateHint: string | null;
  timeHint: string | null;
  missingFields: string[];
  prompt: string;
  confirmCommand: string;
  editCommand: string;
};

export type KiyaNotificationResult = {
  sessionId: string;
  hermes: {
    engine: "hermes-webhook" | "local-hermes-planner";
    webhookCalled: boolean;
    error?: string;
    recommendations: HermesRecommendation[];
    calendarProposal?: CalendarProposal;
  };
  telegram: {
    status: "sent" | "dry_run" | "skipped";
    chatId?: string;
    messageId?: number;
    reason?: string;
    deliveries: TelegramDelivery[];
  };
  message: string;
  messages: string[];
};

export type KiyaNotificationLogEntry = KiyaNotificationResult & {
  artifactVersion: "ixi-o-agent.kiya.notification-log.v0";
  createdAt: string;
};

export type KiyaCalendarResultStatus =
  | "proposed"
  | "confirmed"
  | "edited"
  | "created"
  | "cancelled"
  | "failed";

export type KiyaCalendarResultInput = {
  status: KiyaCalendarResultStatus;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  note?: string;
  hermesRunId?: string;
};

export type KiyaCalendarResultLogEntry = KiyaCalendarResultInput & {
  artifactVersion: "ixi-o-agent.kiya.calendar-result.v0";
  sessionId: string;
  recordedAt: string;
};

type HermesWebhookResponse = {
  message?: unknown;
  text?: unknown;
  agentMessage?: unknown;
  recommendations?: unknown;
  calendarProposal?: unknown;
};

const HERMES_TIMEOUT_MS = 20_000;
const TELEGRAM_LIMIT = 3900;

type TelegramDelivery = {
  index: number;
  status: "sent" | "dry_run" | "skipped";
  messageId?: number;
  reason?: string;
};

export async function notifyKiyaForSession(
  session: StoredVoiceSessionDetail
): Promise<KiyaNotificationResult> {
  const payload = buildSafeSessionPayload(session);
  const hermes = await planWithHermes(payload);
  const summaryMessage = formatSummaryMessage(payload);
  const calendarMessage = hermes.calendarProposal?.detected
    ? formatCalendarProposalMessage(payload, hermes.calendarProposal, hermes.agentMessage)
    : undefined;
  const messages = [summaryMessage, calendarMessage].filter((item): item is string => Boolean(item));
  const telegram = await sendTelegramMessages(
    messages.map((message, index) => ({
      text: message,
      replyMarkup:
        index === 1 && hermes.calendarProposal?.detected
          ? buildCalendarReplyMarkup(payload.sessionId)
          : undefined
    }))
  );

  const result = {
    sessionId: session.sessionId,
    hermes: {
      engine: hermes.engine,
      webhookCalled: hermes.webhookCalled,
      error: hermes.error,
      recommendations: hermes.recommendations,
      calendarProposal: hermes.calendarProposal
    },
    telegram,
    message: summaryMessage,
    messages
  };

  await persistKiyaNotification(session, result);
  return result;
}

export async function readLatestKiyaNotification(
  session: StoredVoiceSessionDetail
): Promise<KiyaNotificationLogEntry | undefined> {
  try {
    const raw = await readFile(getLatestKiyaNotificationPath(session), "utf8");
    return JSON.parse(raw) as KiyaNotificationLogEntry;
  } catch {
    return undefined;
  }
}

export async function recordKiyaCalendarResult(
  session: StoredVoiceSessionDetail,
  input: KiyaCalendarResultInput
): Promise<KiyaCalendarResultLogEntry> {
  const entry: KiyaCalendarResultLogEntry = {
    artifactVersion: "ixi-o-agent.kiya.calendar-result.v0",
    sessionId: session.sessionId,
    recordedAt: new Date().toISOString(),
    status: input.status,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    note: input.note,
    hermesRunId: input.hermesRunId
  };
  const latestPath = getLatestKiyaCalendarResultPath(session);
  const logPath = path.join(session.files.sessionPath, "agent", "kiya-calendar-result.log.jsonl");
  await mkdir(path.dirname(latestPath), { recursive: true });
  await writeFile(latestPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export async function readLatestKiyaCalendarResult(
  session: StoredVoiceSessionDetail
): Promise<KiyaCalendarResultLogEntry | undefined> {
  try {
    const raw = await readFile(getLatestKiyaCalendarResultPath(session), "utf8");
    return JSON.parse(raw) as KiyaCalendarResultLogEntry;
  } catch {
    return undefined;
  }
}

function buildSafeSessionPayload(session: StoredVoiceSessionDetail) {
  const handoff = session.handoff;
  const actionItems = handoff?.actionItems ?? session.exaone?.actionItems ?? [];

  return {
    schemaVersion: "ixi-o-agent.kiya.hermes-input.v0",
    sessionId: session.sessionId,
    source: session.source,
    mode: session.mode,
    sourceStartedAt: session.sourceStartedAt,
    sourceEndedAt: session.sourceEndedAt,
    summary:
      handoff?.summary ??
      session.exaone?.summary ??
      "아직 요약이 없습니다. EXAONE 후처리를 먼저 실행해야 합니다.",
    urgency: handoff?.urgency ?? session.exaone?.urgency ?? "unknown",
    requiredTeams: handoff?.requiredTeams ?? session.exaone?.requiredTeams ?? [],
    actionItems: actionItems.map((item) => ({
      text: item.text,
      owner: item.owner,
      status: item.status ?? "open"
    })),
    openQuestions: session.exaone?.openQuestions ?? [],
    review: {
      reviewed: session.review.reviewed,
      externalAllowed: session.review.externalAllowed
    },
    safety: {
      rawTranscriptIncluded: false,
      rawAudioIncluded: false,
      redactionApplied: handoff?.redactionApplied ?? true,
      humanReviewRequired: true
    },
    sourceRefs: buildSourceRefs(session, handoff)
  };
}

function buildSourceRefs(session: StoredVoiceSessionDetail, handoff: MisoHandoffPayload | undefined) {
  return {
    sourceSystem:
      handoff?.sourceSystem ??
      (session.source === "local_voice_upload" ? "local_voice" : "channel_talk"),
    sourceMode: handoff?.sourceMode ?? session.mode,
    channelId: handoff?.sourceRefs.channelId ?? session.metadata.channelId ?? "unknown",
    userChatId: handoff?.sourceRefs.userChatId ?? session.metadata.userChatId ?? "unknown",
    callLogId: handoff?.sourceRefs.callLogId ?? session.metadata.callLogId ?? null,
    meetMessageId: handoff?.sourceRefs.meetMessageId ?? session.metadata.meetMessageId ?? null
  };
}

async function persistKiyaNotification(
  session: StoredVoiceSessionDetail,
  result: KiyaNotificationResult
) {
  const entry: KiyaNotificationLogEntry = {
    artifactVersion: "ixi-o-agent.kiya.notification-log.v0",
    createdAt: new Date().toISOString(),
    ...result
  };
  const latestPath = getLatestKiyaNotificationPath(session);
  const logPath = path.join(session.files.sessionPath, "agent", "kiya-notification.log.jsonl");
  await mkdir(path.dirname(latestPath), { recursive: true });
  await writeFile(latestPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function getLatestKiyaNotificationPath(session: StoredVoiceSessionDetail): string {
  return path.join(session.files.sessionPath, "agent", "kiya-notification.latest.json");
}

function getLatestKiyaCalendarResultPath(session: StoredVoiceSessionDetail): string {
  return path.join(session.files.sessionPath, "agent", "kiya-calendar-result.latest.json");
}

async function planWithHermes(payload: ReturnType<typeof buildSafeSessionPayload>): Promise<{
  engine: "hermes-webhook" | "local-hermes-planner";
  webhookCalled: boolean;
  error?: string;
  agentMessage?: string;
  recommendations: HermesRecommendation[];
  calendarProposal?: CalendarProposal;
}> {
  const webhookUrl = process.env.HERMES_AGENT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    const calendarProposal = buildLocalCalendarProposal(payload);
    return {
      engine: "local-hermes-planner",
      webhookCalled: false,
      calendarProposal,
      recommendations: calendarProposal.detected ? [toCalendarRecommendation(calendarProposal)] : []
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HERMES_TIMEOUT_MS);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(process.env.HERMES_AGENT_API_KEY
          ? { authorization: `Bearer ${process.env.HERMES_AGENT_API_KEY}` }
          : {})
      },
      body: JSON.stringify({
        event: "ixi_o_agent.voice_session.calendar_check",
        instruction:
          "요약과 액션아이템만 보고 캘린더 등록이 필요한지 판단하세요. 필요하면 사용자가 확인하거나 수정할 수 있는 일정 후보만 제안하세요. 원문 전사문이나 raw audio는 요청하지 마세요. 실제 캘린더 등록은 사용자가 Kiya에서 확인한 뒤 Kiya/Hermes가 처리합니다. 확인/수정/취소 결과는 ixi-O Agent의 /api/kiya/calendar-command 또는 /api/sessions/{sessionId}/kiya-calendar-result로 기록할 수 있습니다.",
        payload,
        availableActions: ["calendar.create_event_draft", "ixi_o_agent.record_calendar_command"]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`hermes_http_${response.status}`);
    }

    const body = (await response.json().catch(() => ({}))) as HermesWebhookResponse;
    const calendarProposal =
      normalizeCalendarProposal(body.calendarProposal, payload) ?? buildLocalCalendarProposal(payload);
    const recommendations = normalizeRecommendations(body.recommendations);
    return {
      engine: "hermes-webhook",
      webhookCalled: true,
      agentMessage: getString(body.agentMessage) ?? getString(body.message) ?? getString(body.text),
      recommendations:
        recommendations.length > 0
          ? recommendations.filter((item) => item.type === "calendar")
          : calendarProposal.detected
            ? [toCalendarRecommendation(calendarProposal)]
            : [],
      calendarProposal
    };
  } catch (error) {
    const calendarProposal = buildLocalCalendarProposal(payload);
    return {
      engine: "local-hermes-planner",
      webhookCalled: true,
      error: error instanceof Error ? error.message : "unknown_hermes_error",
      calendarProposal,
      recommendations: calendarProposal.detected ? [toCalendarRecommendation(calendarProposal)] : []
    };
  }
}

function buildLocalCalendarProposal(payload: ReturnType<typeof buildSafeSessionPayload>): CalendarProposal {
  const text = [
    payload.summary,
    payload.actionItems.map((item) => item.text).join("\n"),
    payload.openQuestions.join("\n")
  ].join("\n");
  const dateHint = extractFirstMatch(text, [
    /\b\d{4}-\d{1,2}-\d{1,2}\b/,
    /\b\d{1,2}\/\d{1,2}\b/,
    /\b\d{1,2}월\s*\d{1,2}일\b/,
    /오늘|내일|모레|다음\s*주|이번\s*주/
  ]);
  const timeHint = extractFirstMatch(text, [
    /오전\s*\d{1,2}시(?:\s*\d{1,2}분)?/,
    /오후\s*\d{1,2}시(?:\s*\d{1,2}분)?/,
    /\b\d{1,2}:\d{2}\b/,
    /\b\d{1,2}시(?:\s*\d{1,2}분)?/
  ]);
  const hasCalendarIntent = hasAny(text, [
    "캘린더",
    "일정 잡",
    "일정 추가",
    "일정 등록",
    "일정을 잡",
    "미팅",
    "회의",
    "약속",
    "만나",
    "방문",
    "예약"
  ]);
  const detected = hasCalendarIntent && Boolean(dateHint || timeHint || text.includes("캘린더"));
  const missingFields = [
    dateHint ? undefined : "date",
    timeHint ? undefined : "time"
  ].filter((item): item is string => Boolean(item));
  const title = buildCalendarTitle(payload);

  return {
    detected,
    title,
    dateHint,
    timeHint,
    missingFields,
    prompt: buildCalendarPrompt(dateHint, timeHint),
    confirmCommand: `ixo:cal:ok:${payload.sessionId}`,
    editCommand: `ixo:cal:edit:${payload.sessionId}`
  };
}

function toCalendarRecommendation(proposal: CalendarProposal): HermesRecommendation {
  return {
    type: "calendar",
    title: "캘린더 등록 확인",
    reason: "요약 또는 액션아이템에 일정으로 등록할 만한 표현이 있습니다.",
    nextStep: proposal.prompt
  };
}

async function sendTelegramMessages(
  messages: Array<{ text: string; replyMarkup?: Record<string, unknown> }>
): Promise<KiyaNotificationResult["telegram"]> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_KIYA_CHAT_ID ?? process.env.TELEGRAM_ALLOWED_CHAT_ID)?.trim();

  if (!token || !chatId) {
    return {
      status: "dry_run",
      reason: "missing_telegram_bot_token_or_chat_id",
      deliveries: messages.map((_, index) => ({
        index,
        status: "dry_run",
        reason: "missing_telegram_bot_token_or_chat_id"
      }))
    };
  }

  const deliveries: TelegramDelivery[] = [];
  for (const [index, message] of messages.entries()) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.text.slice(0, TELEGRAM_LIMIT),
        disable_web_page_preview: true,
        protect_content: true,
        ...(message.replyMarkup ? { reply_markup: message.replyMarkup } : {})
      })
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };

    if (!response.ok || body.ok === false) {
      deliveries.push({
        index,
        status: "skipped",
        reason: `telegram_send_failed:${response.status}:${body.description ?? "unknown"}`
      });
      continue;
    }

    deliveries.push({
      index,
      status: "sent",
      messageId: body.result?.message_id
    });
  }

  const failed = deliveries.find((item) => item.status !== "sent");
  return {
    status: failed ? "skipped" : "sent",
    chatId,
    messageId: deliveries.find((item) => item.messageId)?.messageId,
    reason: failed?.reason,
    deliveries
  };
}

function formatSummaryMessage(payload: ReturnType<typeof buildSafeSessionPayload>): string {
  const actionLines =
    payload.actionItems.length === 0
      ? ["- 추출된 액션아이템 없음"]
      : payload.actionItems.slice(0, 6).map((item) => `- ${item.text}`);

  return [
    "ixi-O Agent 요약",
    "",
    `세션: ${payload.sessionId}`,
    `입력: ${payload.sourceRefs.sourceSystem} / ${payload.sourceRefs.sourceMode}`,
    `긴급도: ${payload.urgency}`,
    "",
    "요약",
    payload.summary,
    "",
    "액션아이템",
    ...actionLines,
    "",
    "보안",
    "- raw transcript/audio 미포함",
    "- 외부 실행 전 사용자 확인 필요"
  ].join("\n");
}

function formatCalendarProposalMessage(
  payload: ReturnType<typeof buildSafeSessionPayload>,
  proposal: CalendarProposal,
  agentMessage: string | undefined
): string {
  return [
    "캘린더 등록 후보",
    "",
    proposal.prompt,
    "",
    `제안 제목: ${proposal.title}`,
    `날짜 후보: ${proposal.dateHint ?? "확인 필요"}`,
    `시간 후보: ${proposal.timeHint ?? "확인 필요"}`,
    `세션: ${payload.sessionId}`,
    "",
    "Kiya에서 바로 처리할 수 있는 응답 예시",
    "- 확인",
    "- 내일 오후 3시로 수정",
    "- 제목을 고객 후속 미팅으로 바꿔줘",
    "- 취소",
    ...(agentMessage ? ["", "Hermes 메모", agentMessage] : []),
    "",
    "실제 캘린더 등록은 Kiya/Hermes가 사용자 확인 후 처리합니다."
  ].join("\n");
}

function buildCalendarReplyMarkup(sessionId: string): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        {
          text: "캘린더 등록 확인",
          callback_data: `ixo:cal:ok:${sessionId}`.slice(0, 64)
        },
        {
          text: "시간/내용 수정",
          callback_data: `ixo:cal:edit:${sessionId}`.slice(0, 64)
        }
      ],
      [
        {
          text: "등록 취소",
          callback_data: `ixo:cal:cancel:${sessionId}`.slice(0, 64)
        }
      ]
    ]
  };
}

function normalizeRecommendations(value: unknown): HermesRecommendation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): HermesRecommendation | undefined => {
      if (typeof item === "string") {
        return {
          type: "follow_up",
          title: item,
          reason: "Hermes agent recommendation",
          nextStep: "사용자 확인 후 실행"
        };
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
      const record = item as Record<string, unknown>;
      const title = getString(record.title) ?? getString(record.name);
      if (!title) return undefined;
      return {
        type: normalizeRecommendationType(getString(record.type)),
        title,
        reason: getString(record.reason) ?? "Hermes agent recommendation",
        nextStep: getString(record.nextStep) ?? getString(record.next_step) ?? "사용자 확인 후 실행"
      };
    })
    .filter((item): item is HermesRecommendation => Boolean(item));
}

function normalizeRecommendationType(value: string | undefined): HermesRecommendation["type"] {
  if (value === "calendar" || value === "follow_up" || value === "review") {
    return value;
  }
  return "follow_up";
}

function normalizeCalendarProposal(
  value: unknown,
  payload: ReturnType<typeof buildSafeSessionPayload>
): CalendarProposal | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const detected = getBoolean(record.detected) ?? getBoolean(record.shouldCreateCalendarEvent);
  if (detected !== true) return { ...buildLocalCalendarProposal(payload), detected: false };
  const local = buildLocalCalendarProposal(payload);
  return {
    detected: true,
    title: getString(record.title) ?? local.title,
    dateHint: getString(record.dateHint) ?? getString(record.date) ?? local.dateHint,
    timeHint: getString(record.timeHint) ?? getString(record.time) ?? local.timeHint,
    missingFields: toStringArray(record.missingFields) ?? local.missingFields,
    prompt: getString(record.prompt) ?? local.prompt,
    confirmCommand: getString(record.confirmCommand) ?? local.confirmCommand,
    editCommand: getString(record.editCommand) ?? local.editCommand
  };
}

function buildCalendarPrompt(dateHint: string | null, timeHint: string | null): string {
  if (!dateHint) return "캘린더 며칠에 일정을 추가해드릴까요?";
  if (!timeHint) return `${dateHint} 일정으로 보입니다. 몇 시에 추가해드릴까요?`;
  return `${dateHint} ${timeHint} 일정으로 캘린더에 추가할까요?`;
}

function buildCalendarTitle(payload: ReturnType<typeof buildSafeSessionPayload>): string {
  const firstAction = payload.actionItems.find((item) => item.text.trim())?.text;
  const source =
    firstAction ??
    payload.summary
      .replace(/\s+/g, " ")
      .slice(0, 48)
      .trim();
  return source ? `ixi-O Agent: ${source}` : "ixi-O Agent 후속 일정";
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function hasAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
