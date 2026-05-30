const accessKey = process.env.CHANNEL_TALK_ACCESS_KEY;
const accessSecret = process.env.CHANNEL_TALK_ACCESS_SECRET;

if (!accessKey || !accessSecret) {
  console.error("CHANNEL_TALK_ACCESS_KEY and CHANNEL_TALK_ACCESS_SECRET are required.");
  process.exit(1);
}

const url = new URL("https://api.channel.io/open/v5/user-chats");
url.searchParams.set("state", "opened");
url.searchParams.set("sortOrder", "desc");
url.searchParams.set("limit", "1");

const response = await fetch(url, {
  headers: {
    accept: "application/json",
    "x-access-key": accessKey,
    "x-access-secret": accessSecret
  }
});

const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

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

const count = Array.isArray(body?.userChats)
  ? body.userChats.length
  : Array.isArray(body?.messages)
    ? body.messages.length
    : undefined;

console.log(
  JSON.stringify(
    {
      ok: true,
      status: response.status,
      returnedItems: count,
      topLevelKeys: typeof body === "object" && body ? Object.keys(body) : []
    },
    null,
    2
  )
);

