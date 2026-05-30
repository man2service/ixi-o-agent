import { NextRequest, NextResponse } from "next/server";
import { normalizeChannelTalkOpenApiPayload } from "@phone-claw/core";
import { ingestChannelTalkPayload } from "@phone-claw/storage";

type BackfillRequest = {
  states?: string[];
  chatLimit?: number;
  chatPages?: number;
  messageLimit?: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PHONE_CLAW_INGEST_SECRET;
  const actualSecret = request.headers.get("x-phone-claw-ingest-secret");

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "server_missing_ingest_secret" },
      { status: 500 }
    );
  }

  if (actualSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "invalid_ingest_secret" },
      { status: 401 }
    );
  }

  const accessKey = process.env.CHANNEL_TALK_ACCESS_KEY;
  const accessSecret = process.env.CHANNEL_TALK_ACCESS_SECRET;
  if (!accessKey || !accessSecret) {
    return NextResponse.json(
      { ok: false, error: "missing_channel_talk_credentials" },
      { status: 500 }
    );
  }

  const body = await readBody(request);
  const states = normalizeStates(
    body.states ??
      process.env.CHANNEL_TALK_BACKFILL_STATES?.split(",") ??
      process.env.CHANNEL_TALK_BACKFILL_STATE?.split(",") ??
      ["closed"]
  );
  const chatLimit = clamp(body.chatLimit ?? readEnvInt("CHANNEL_TALK_BACKFILL_LIMIT", 10), 1, 500);
  const chatPages = clamp(body.chatPages ?? readEnvInt("CHANNEL_TALK_BACKFILL_PAGES", 1), 1, 20);
  const messageLimit = clamp(body.messageLimit ?? readEnvInt("CHANNEL_TALK_MESSAGE_LIMIT", 100), 1, 5000);

  const results = [];
  for (const state of states) {
    let since: string | undefined;
    for (let page = 0; page < chatPages; page += 1) {
      const userChatsResponse = await channelRequest(accessKey, accessSecret, "/user-chats", {
        state,
        sortOrder: "desc",
        limit: String(chatLimit),
        ...(since ? { since } : {})
      });
      const userChats = getArray(userChatsResponse.userChats) ?? getArray(userChatsResponse.messages) ?? [];

      for (const userChat of userChats) {
        const userChatRecord = asRecord(userChat);
        const userChatId = getString(userChatRecord, "id");
        if (!userChatId) continue;

        const messages = await fetchAllMessages(
          accessKey,
          accessSecret,
          userChatId,
          messageLimit
        );
        const payload = normalizeChannelTalkOpenApiPayload({
          source: "channel_talk_openapi",
          mode: "call",
          userChat,
          messages,
          rawEvent: {
            fetchedBy: "api/backfill/channel-talk",
            state
          }
        });
        const ingestResult = await ingestChannelTalkPayload(payload);

        results.push({
          state,
          userChatId,
          result: ingestResult.result,
          sessionId: ingestResult.sessionId
        });
      }

      since = getString(asRecord(userChatsResponse), "next");
      if (!since) break;
    }
  }

  return NextResponse.json({
    ok: true,
    states,
    fetchedUserChats: results.length,
    ingested: results
  });
}

async function readBody(request: NextRequest): Promise<BackfillRequest> {
  try {
    return (await request.json()) as BackfillRequest;
  } catch {
    return {};
  }
}

async function fetchAllMessages(
  accessKey: string,
  accessSecret: string,
  userChatId: string,
  maxMessages: number
) {
  const messages = [];
  let since: string | undefined;

  while (messages.length < maxMessages) {
    const response = await channelRequest(
      accessKey,
      accessSecret,
      `/user-chats/${encodeURIComponent(userChatId)}/messages`,
      {
        sortOrder: "asc",
        limit: String(Math.min(500, maxMessages - messages.length)),
        ...(since ? { since } : {})
      }
    );
    messages.push(...(getArray(response.messages) ?? []));
    since = getString(asRecord(response), "next");
    if (!since) break;
  }

  return messages;
}

async function channelRequest(
  accessKey: string,
  accessSecret: string,
  path: string,
  params: Record<string, string>
) {
  const url = new URL(`https://api.channel.io/open/v5${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-access-key": accessKey,
      "x-access-secret": accessSecret
    }
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `channel_talk_api_failed:${response.status}:${JSON.stringify(body)?.slice(0, 300)}`
    );
  }

  return body;
}

function normalizeStates(states: string[]) {
  const allowed = new Set(["closed", "opened", "snoozed"]);
  const normalized = states.map((state) => state.trim()).filter((state) => allowed.has(state));
  return normalized.length > 0 ? normalized : ["closed"];
}

function readEnvInt(key: string, fallback: number) {
  const value = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function getString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
