import { readFile } from "node:fs/promises";

const endpoint =
  process.env.PHONE_CLAW_INGEST_URL ??
  "http://localhost:3000/api/ingest/channel-talk";
const secret = process.env.PHONE_CLAW_INGEST_SECRET;

if (!secret) {
  console.error("PHONE_CLAW_INGEST_SECRET is required.");
  process.exit(1);
}

const payload = JSON.parse(
  await readFile(new URL("../sample-data/channel-talk-normalized.json", import.meta.url), "utf8")
);

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-phone-claw-ingest-secret": secret
  },
  body: JSON.stringify(payload)
});

console.log(response.status);
console.log(await response.text());

