const accessKey = process.env.CHANNEL_TALK_ACCESS_KEY;
const accessSecret = process.env.CHANNEL_TALK_ACCESS_SECRET;
const ingestSecret = process.env.PHONE_CLAW_INGEST_SECRET;
const ingestUrl =
  process.env.PHONE_CLAW_INGEST_URL ??
  "http://localhost:3000/api/ingest/channel-talk/openapi";
const states = (process.env.CHANNEL_TALK_BACKFILL_STATES ?? process.env.CHANNEL_TALK_BACKFILL_STATE ?? "closed")
  .split(",")
  .map((state) => state.trim())
  .filter(Boolean);
const chatLimit = clamp(readPositiveInt(process.env.CHANNEL_TALK_BACKFILL_LIMIT, 20), 1, 500);
const chatPages = readPositiveInt(process.env.CHANNEL_TALK_BACKFILL_PAGES, 1);
const messageLimit = readPositiveInt(process.env.CHANNEL_TALK_MESSAGE_LIMIT, 100);

if (!accessKey || !accessSecret || !ingestSecret) {
  console.error(
    "CHANNEL_TALK_ACCESS_KEY, CHANNEL_TALK_ACCESS_SECRET, and PHONE_CLAW_INGEST_SECRET are required."
  );
  process.exit(1);
}

const userChats = [];
for (const state of states) {
  let since;
  for (let page = 0; page < chatPages; page += 1) {
    const userChatsResponse = await channelRequest("/user-chats", {
      state,
      sortOrder: "desc",
      limit: String(chatLimit),
      ...(since ? { since } : {})
    });
    const pageUserChats =
      getArray(userChatsResponse.userChats) ?? getArray(userChatsResponse.messages) ?? [];
    userChats.push(...pageUserChats.map((userChat) => ({ state, userChat })));
    since = typeof userChatsResponse.next === "string" ? userChatsResponse.next : undefined;
    if (!since) break;
  }
}

const results = [];
for (const { state, userChat } of userChats) {
  const userChatId = typeof userChat?.id === "string" ? userChat.id : undefined;
  if (!userChatId) continue;

  const messages = await fetchAllMessages(userChatId, messageLimit);

  const ingestResponse = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-phone-claw-ingest-secret": ingestSecret
    },
    body: JSON.stringify({
      source: "channel_talk_openapi",
      mode: "call",
      userChat,
      messages,
      rawEvent: {
        fetchedBy: "scripts/channel-talk-backfill.mjs",
        state
      }
    })
  });

  const ingestBody = await safeJson(ingestResponse);
  results.push({
    userChatId,
    status: ingestResponse.status,
    ok: ingestResponse.ok,
    result: ingestBody?.result,
    sessionId: ingestBody?.sessionId,
    error: ingestBody?.error
  });
}

console.log(
  JSON.stringify(
    {
      ok: results.every((result) => result.ok),
      fetchedUserChats: userChats.length,
      ingested: results
    },
    null,
    2
  )
);

async function fetchAllMessages(userChatId, maxMessages) {
  const messages = [];
  let since;

  while (messages.length < maxMessages) {
    const response = await channelRequest(
      `/user-chats/${encodeURIComponent(userChatId)}/messages`,
      {
        sortOrder: "asc",
        limit: String(Math.min(500, maxMessages - messages.length)),
        ...(since ? { since } : {})
      }
    );
    messages.push(...(getArray(response.messages) ?? []));
    since = typeof response.next === "string" ? response.next : undefined;
    if (!since) break;
  }

  return messages;
}

async function channelRequest(path, params) {
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
  const body = await safeJson(response);

  if (!response.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: response.status,
          statusText: response.statusText,
          body
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  return body;
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getArray(value) {
  return Array.isArray(value) ? value : undefined;
}
