import type { MisoHandoffPayload, StoredVoiceSessionDetail } from "@phone-claw/storage";

export type HermesRecommendation = {
  type: "calendar" | "travel" | "oba_openapi" | "follow_up" | "review";
  title: string;
  reason: string;
  nextStep: string;
};

export type KiyaNotificationResult = {
  sessionId: string;
  hermes: {
    engine: "hermes-webhook" | "local-hermes-planner";
    webhookCalled: boolean;
    error?: string;
    recommendations: HermesRecommendation[];
  };
  telegram: {
    status: "sent" | "dry_run" | "skipped";
    chatId?: string;
    messageId?: number;
    reason?: string;
  };
  message: string;
};

type HermesWebhookResponse = {
  message?: unknown;
  text?: unknown;
  agentMessage?: unknown;
  recommendations?: unknown;
};

const HERMES_TIMEOUT_MS = 20_000;
const TELEGRAM_LIMIT = 3900;

export async function notifyKiyaForSession(
  session: StoredVoiceSessionDetail
): Promise<KiyaNotificationResult> {
  const payload = buildSafeSessionPayload(session);
  const hermes = await planWithHermes(payload);
  const message = formatKiyaMessage(payload, hermes.recommendations, hermes.agentMessage);
  const telegram = await sendTelegramMessage(message);

  return {
    sessionId: session.sessionId,
    hermes: {
      engine: hermes.engine,
      webhookCalled: hermes.webhookCalled,
      error: hermes.error,
      recommendations: hermes.recommendations
    },
    telegram,
    message
  };
}

function buildSafeSessionPayload(session: StoredVoiceSessionDetail) {
  const handoff = session.handoff;
  const actionItems = session.exaone?.actionItems ?? handoff?.actionItems ?? [];

  return {
    schemaVersion: "phone-claw.kiya.hermes-input.v0",
    sessionId: session.sessionId,
    source: session.source,
    mode: session.mode,
    sourceStartedAt: session.sourceStartedAt,
    sourceEndedAt: session.sourceEndedAt,
    summary:
      session.exaone?.summary ??
      handoff?.summary ??
      "아직 요약이 없습니다. EXAONE 후처리를 먼저 실행해야 합니다.",
    urgency: session.exaone?.urgency ?? handoff?.urgency ?? "unknown",
    requiredTeams: session.exaone?.requiredTeams ?? handoff?.requiredTeams ?? [],
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
      handoff?.sourceSystem ?? (session.source === "local_voice_upload" ? "local_voice" : "channel_talk"),
    sourceMode: handoff?.sourceMode ?? session.mode,
    channelId: handoff?.sourceRefs.channelId ?? session.metadata.channelId ?? "unknown",
    userChatId: handoff?.sourceRefs.userChatId ?? session.metadata.userChatId ?? "unknown",
    callLogId: handoff?.sourceRefs.callLogId ?? session.metadata.callLogId ?? null,
    meetMessageId: handoff?.sourceRefs.meetMessageId ?? session.metadata.meetMessageId ?? null
  };
}

async function planWithHermes(payload: ReturnType<typeof buildSafeSessionPayload>): Promise<{
  engine: "hermes-webhook" | "local-hermes-planner";
  webhookCalled: boolean;
  error?: string;
  agentMessage?: string;
  recommendations: HermesRecommendation[];
}> {
  const webhookUrl = process.env.HERMES_AGENT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      engine: "local-hermes-planner",
      webhookCalled: false,
      recommendations: buildLocalHermesRecommendations(payload)
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
        event: "phone_claw.voice_session.ready",
        instruction:
          "요약과 액션아이템만 보고 다음 행동을 추천하세요. 원문 전사문이나 raw audio는 요청하지 마세요.",
        payload,
        availableActions: [
          "calendar.create_event_draft",
          "travel.flight_recommendation",
          "oba.openapi_tool_suggestion",
          "follow_up.message_draft",
          "human_review_request"
        ]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`hermes_http_${response.status}`);
    }

    const body = (await response.json().catch(() => ({}))) as HermesWebhookResponse;
    const recommendations = normalizeRecommendations(body.recommendations);
    return {
      engine: "hermes-webhook",
      webhookCalled: true,
      agentMessage: getString(body.agentMessage) ?? getString(body.message) ?? getString(body.text),
      recommendations:
        recommendations.length > 0 ? recommendations : buildLocalHermesRecommendations(payload)
    };
  } catch (error) {
    return {
      engine: "local-hermes-planner",
      webhookCalled: true,
      error: error instanceof Error ? error.message : "unknown_hermes_error",
      recommendations: buildLocalHermesRecommendations(payload)
    };
  }
}

function buildLocalHermesRecommendations(
  payload: ReturnType<typeof buildSafeSessionPayload>
): HermesRecommendation[] {
  const text = [
    payload.summary,
    payload.actionItems.map((item) => item.text).join("\n"),
    payload.openQuestions.join("\n")
  ].join("\n");
  const recommendations: HermesRecommendation[] = [];

  if (hasAny(text, ["일정", "미팅", "회의", "약속", "내일", "오전", "오후", "날짜", "캘린더"])) {
    recommendations.push({
      type: "calendar",
      title: "캘린더 초안 만들기",
      reason: "요약 또는 액션아이템에 일정/미팅 관련 표현이 있습니다.",
      nextStep:
        "상대, 날짜, 시간, 장소가 충분하면 캘린더 이벤트 초안을 만들고 부족한 값은 사용자에게 질문합니다."
    });
  }

  if (hasAny(text, ["항공", "항공권", "비행기", "출장", "여행", "공항", "숙소", "마이리얼트립"])) {
    recommendations.push({
      type: "travel",
      title: "항공권/여행 옵션 추천",
      reason: "출장 또는 이동 관련 맥락이 감지되었습니다.",
      nextStep: "출발지, 도착지, 날짜, 예산을 확인한 뒤 여행/항공 API 후보를 추천합니다."
    });
  }

  if (hasAny(text, ["OBA", "해커톤", "API", "OpenAPI", "MISO", "채널톡", "후원사"])) {
    recommendations.push({
      type: "oba_openapi",
      title: "OBA 제공 OpenAPI 연결 후보 찾기",
      reason: "OBA/후원사/API 관련 작업 가능성이 있습니다.",
      nextStep:
        "MISO custom tool, Myrealtrip, Rocketpunch, API Fuse 등 현재 작업에 맞는 후원사 API 후보를 제안합니다."
    });
  }

  if (payload.actionItems.length > 0) {
    recommendations.push({
      type: "follow_up",
      title: "후속 메시지/작업 초안 만들기",
      reason: `${payload.actionItems.length}개의 액션아이템이 있습니다.`,
      nextStep: "각 액션아이템을 담당자/마감일/상태로 정리하고 사용자 확인 후 전송 또는 등록합니다."
    });
  }

  recommendations.push({
    type: "review",
    title: "사용자 확인 받기",
    reason: "외부 실행 전에 사용자가 요약과 다음 행동을 확인해야 합니다.",
    nextStep: "Kiya가 추천 작업을 보여주고 사용자가 승인한 작업만 실행합니다."
  });

  return recommendations;
}

async function sendTelegramMessage(message: string): Promise<KiyaNotificationResult["telegram"]> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_KIYA_CHAT_ID ?? process.env.TELEGRAM_ALLOWED_CHAT_ID)?.trim();

  if (!token || !chatId) {
    return {
      status: "dry_run",
      reason: "missing_telegram_bot_token_or_chat_id"
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message.slice(0, TELEGRAM_LIMIT),
      disable_web_page_preview: true,
      protect_content: true
    })
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };

  if (!response.ok || body.ok === false) {
    return {
      status: "skipped",
      chatId,
      reason: `telegram_send_failed:${response.status}:${body.description ?? "unknown"}`
    };
  }

  return {
    status: "sent",
    chatId,
    messageId: body.result?.message_id
  };
}

function formatKiyaMessage(
  payload: ReturnType<typeof buildSafeSessionPayload>,
  recommendations: HermesRecommendation[],
  agentMessage: string | undefined
): string {
  const actionLines =
    payload.actionItems.length === 0
      ? ["- 추출된 액션아이템 없음"]
      : payload.actionItems.slice(0, 6).map((item) => `- ${item.text}`);
  const recommendationLines = recommendations
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title}\n   이유: ${item.reason}\n   다음: ${item.nextStep}`);

  return [
    "Phone-Claw voice session ready",
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
    "Hermes 추천",
    ...(agentMessage ? [agentMessage, ""] : []),
    ...recommendationLines,
    "",
    "보안",
    "- raw transcript/audio 미포함",
    "- 외부 실행 전 사용자 확인 필요"
  ].join("\n");
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
  if (
    value === "calendar" ||
    value === "travel" ||
    value === "oba_openapi" ||
    value === "follow_up" ||
    value === "review"
  ) {
    return value;
  }
  return "follow_up";
}

function hasAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
