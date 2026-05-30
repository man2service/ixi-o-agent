const accessKey = process.env.CHANNEL_TALK_ACCESS_KEY;
const accessSecret = process.env.CHANNEL_TALK_ACCESS_SECRET;
const action = process.argv[2] ?? process.env.CHANNEL_TALK_WEBHOOK_ACTION ?? "list";
const webhookName = process.env.CHANNEL_TALK_WEBHOOK_NAME ?? "Phone-Claw n8n realtime";
const webhookUrl = process.env.CHANNEL_TALK_WEBHOOK_URL;
const scopes = (process.env.CHANNEL_TALK_WEBHOOK_SCOPES ?? "message.created.userChat,userChat.opened")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

if (!accessKey || !accessSecret) {
  console.error("CHANNEL_TALK_ACCESS_KEY and CHANNEL_TALK_ACCESS_SECRET are required.");
  process.exit(1);
}

if (action === "list") {
  const webhooks = await listWebhooks();
  printWebhooks({ ok: true, action, webhooks });
  process.exit(0);
}

if (action !== "create" && action !== "update" && action !== "upsert") {
  console.error("Usage: pnpm webhook:channel-talk [list|create|update|upsert]");
  process.exit(1);
}

if (!webhookUrl) {
  console.error("CHANNEL_TALK_WEBHOOK_URL is required for create/upsert.");
  process.exit(1);
}

const existing = await listWebhooks();
const matched = existing.find((webhook) => webhook.name === webhookName || webhook.url === webhookUrl);
if (action === "update" || (action === "upsert" && matched)) {
  if (!matched) {
    console.error(`No webhook matched name or URL: ${webhookName}`);
    process.exit(1);
  }
  const updated = await updateWebhook(matched.id, {
    name: webhookName,
    url: webhookUrl,
    scopes,
    apiVersion: "v5",
    blocked: false
  });
  printWebhooks({ ok: true, action, reused: true, webhooks: [updated] });
  process.exit(0);
}

const created = await createWebhook({
  name: webhookName,
  url: webhookUrl,
  scopes
});
printWebhooks({ ok: true, action, reused: false, webhooks: [created] });

async function listWebhooks() {
  const response = await channelRequest("https://api.channel.io/open/v5/webhooks?limit=100", {
    method: "GET"
  });
  return Array.isArray(response.webhooks) ? response.webhooks : [];
}

async function createWebhook(payload) {
  const response = await channelRequest("https://api.channel.io/open/v5/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return response.webhook;
}

async function updateWebhook(id, payload) {
  const response = await channelRequest(`https://api.channel.io/open/v5/webhooks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return response.webhook;
}

async function channelRequest(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "x-access-key": accessKey,
      "x-access-secret": accessSecret,
      ...init.headers
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
          code: body?.code,
          message: body?.message,
          errorType: body?.type,
          messages: body?.errors?.map((error) => error.message)
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

function printWebhooks(result) {
  console.log(
    JSON.stringify(
      {
        ...result,
        webhooks: result.webhooks.map((webhook) => ({
          id: webhook.id,
          channelId: webhook.channelId,
          name: webhook.name,
          url: webhook.url,
          scopes: webhook.scopes,
          apiVersion: webhook.apiVersion,
          blocked: webhook.blocked,
          hasToken: Boolean(webhook.token)
        }))
      },
      null,
      2
    )
  );
}
