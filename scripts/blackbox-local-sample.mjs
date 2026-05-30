import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(new URL("..", import.meta.url).pathname);
const appRoot = path.join(workspaceRoot, "apps", "local-web");
const port = Number.parseInt(process.env.PHONE_CLAW_SMOKE_PORT ?? "3210", 10);
const baseUrl = `http://localhost:${port}`;
const ingestSecret = "phone-claw-blackbox-local-secret";
const tempRoot = await mkdtemp(path.join(tmpdir(), "phone-claw-smoke-"));
const storageDir = path.join(tempRoot, "private-voice-inbox");

let server;

try {
  server = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], {
    cwd: appRoot,
    env: {
      ...process.env,
      PHONE_CLAW_STORAGE_DIR: storageDir,
      PHONE_CLAW_INGEST_SECRET: ingestSecret,
      PHONE_CLAW_EXAONE_MODEL_PATH: path.join(tempRoot, "missing-exaone-model.gguf")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const logs = [];
  server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  server.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  server.on("exit", (code) => {
    if (code !== null && code !== 0 && !server.killed) {
      logs.push(`server_exit_${code}`);
    }
  });

  await waitForServer(logs);

  const initial = await getJson("/api/sessions");
  assert(initial.ok === true, "sessions endpoint should respond before ingest");
  assert(initial.sessions.length === 0, "temporary storage should start empty");

  const payload = JSON.parse(
    await readFile(path.join(workspaceRoot, "sample-data", "channel-talk-normalized.json"), "utf8")
  );
  const ingest = await postJson("/api/ingest/channel-talk", payload);
  assert(ingest.ok === true, "sample ingest should succeed");
  assert(typeof ingest.sessionId === "string", "sample ingest should return sessionId");

  const sessions = await getJson("/api/sessions");
  assert(sessions.sessions.length === 1, "sample ingest should create one session");
  assert(sessions.sessions[0].utteranceCount > 0, "sample session should include transcript text");

  const sessionId = ingest.sessionId;
  const processResult = await postJson(`/api/sessions/${sessionId}/process`, undefined, {
    accept: "application/json"
  });
  assert(processResult.ok === true, "local EXAONE process route should succeed");
  assert(processResult.result.engine === "fallback-local", "missing model should use fallback-local");
  assert(processResult.result.modelAvailable === false, "smoke test should not require model file");

  const preReviewMiso = await getJson(`/api/miso/voice-sessions/${sessionId}`, {
    "x-phone-claw-ingest-secret": ingestSecret
  });
  assert(
    preReviewMiso.session.handoff.availableForExternalWorkflow === false,
    "MISO payload should be blocked before review"
  );
  assert(
    preReviewMiso.session.handoff.redactedPayload === undefined,
    "MISO payload body should be hidden before review"
  );

  const review = await postForm(`/api/sessions/${sessionId}/review`, { externalAllowed: "true" });
  assert(review.ok === true, "review route should approve external handoff");
  assert(review.session.review.externalAllowed === true, "review state should allow external handoff");

  const postReviewMiso = await getJson(`/api/miso/voice-sessions/${sessionId}`, {
    "x-phone-claw-ingest-secret": ingestSecret
  });
  assert(
    postReviewMiso.session.handoff.availableForExternalWorkflow === true,
    "MISO payload should become available after approval"
  );
  assert(
    postReviewMiso.session.handoff.redactedPayload?.rawTranscriptIncluded === false,
    "MISO payload should not include raw transcript"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId,
        storageDir,
        checks: [
          "server_started",
          "sample_ingested",
          "fallback_local_processed",
          "miso_blocked_before_review",
          "miso_available_after_review"
        ]
      },
      null,
      2
    )
  );
} finally {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }
  if (process.env.PHONE_CLAW_SMOKE_KEEP_TMP !== "1") {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function waitForServer(logs) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode != null) {
      throw new Error(`server_exited:${server.exitCode}:${logs.join("").slice(-1000)}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/sessions`);
      if (response.ok) return;
      lastError = new Error(`server_status_${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`server_start_timeout:${lastError?.message ?? "unknown"}:${logs.join("").slice(-1000)}`);
}

async function getJson(pathname, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      accept: "application/json",
      ...headers
    }
  });
  return parseResponse(response);
}

async function postJson(pathname, body, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-phone-claw-ingest-secret": ingestSecret,
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return parseResponse(response);
}

async function postForm(pathname, form) {
  const body = new URLSearchParams(form);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { text };
  }
  if (!response.ok) {
    throw new Error(`http_${response.status}:${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`assertion_failed:${message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
