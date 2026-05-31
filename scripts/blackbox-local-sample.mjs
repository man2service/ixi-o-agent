import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(new URL("..", import.meta.url).pathname);
const appRoot = path.join(workspaceRoot, "apps", "local-web");
const port = Number.parseInt(
  process.env.IXI_O_AGENT_SMOKE_PORT ?? process.env.PHONE_CLAW_SMOKE_PORT ?? "3210",
  10
);
const baseUrl = `http://localhost:${port}`;
const ingestSecret = "ixi-o-agent-blackbox-local-secret";
const tempRoot = await mkdtemp(path.join(tmpdir(), "ixi-o-agent-smoke-"));
const storageDir = path.join(tempRoot, "private-voice-inbox");

let server;

try {
  server = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], {
    cwd: appRoot,
    env: {
      ...process.env,
      IXI_O_AGENT_STORAGE_DIR: storageDir,
      PHONE_CLAW_STORAGE_DIR: storageDir,
      IXI_O_AGENT_INGEST_SECRET: ingestSecret,
      PHONE_CLAW_INGEST_SECRET: ingestSecret,
      IXI_O_AGENT_EXAONE_MODEL_PATH: path.join(tempRoot, "missing-exaone-model.gguf"),
      PHONE_CLAW_EXAONE_MODEL_PATH: path.join(tempRoot, "missing-exaone-model.gguf"),
      IXI_O_AGENT_KIYA_AUTO_NOTIFY: "true",
      PHONE_CLAW_KIYA_AUTO_NOTIFY: "true",
      HERMES_AGENT_WEBHOOK_URL: "",
      HERMES_AGENT_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_KIYA_CHAT_ID: "",
      TELEGRAM_ALLOWED_CHAT_ID: ""
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
  assert(
    processResult.kiya?.telegram?.status === "dry_run",
    "Kiya auto notification should dry-run without Telegram credentials"
  );
  assert(
    processResult.kiya?.hermes?.engine === "local-hermes-planner",
    "Hermes recommendation should fall back to local planner without webhook"
  );
  assert(
    processResult.kiya.messages.length === 1,
    "non-calendar sample should send only the summary message"
  );
  const kiyaLog = await readJsonFile(
    path.join(storageDir, "sessions", sessionId, "agent", "kiya-notification.latest.json")
  );
  assert(
    kiyaLog.telegram.status === "dry_run" && kiyaLog.messages.length === 1,
    "Kiya dry-run should be persisted for operator review"
  );

  const preReviewMiso = await getJson(`/api/miso/voice-sessions/${sessionId}`, {
    "x-ixi-o-agent-ingest-secret": ingestSecret,
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
    "x-ixi-o-agent-ingest-secret": ingestSecret,
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

  const localVoice = await postForm("/api/ingest/local-voice", {
    title: "Smoke local meeting",
    mode: "meeting",
    transcriptText:
      "오늘 회의에서는 로컬 음성 입력을 에이전트 작업으로 바꾸는 흐름을 확인했다. 내일 오후 3시에 후속 미팅을 캘린더에 잡기로 했다."
  });
  assert(localVoice.ok === true, "local voice frontdoor should create a session");
  const localVoiceDetail = await getJson(`/api/sessions/${localVoice.sessionId}`);
  assert(
    localVoiceDetail.session.source === "local_voice_upload",
    "local voice session should preserve source"
  );
  assert(
    localVoiceDetail.session.mode === "meeting",
    "local voice session should preserve meeting mode"
  );

  const localVoiceProcess = await postJson(
    `/api/sessions/${localVoice.sessionId}/process`,
    undefined,
    {
      accept: "application/json"
    }
  );
  assert(localVoiceProcess.ok === true, "calendar local voice process should succeed");
  assert(
    localVoiceProcess.kiya.messages.length === 2,
    "calendar-worthy session should send summary plus calendar proposal"
  );
  assert(
    localVoiceProcess.kiya.hermes.calendarProposal?.detected === true,
    "calendar-worthy session should include a calendar proposal"
  );
  assert(
    localVoiceProcess.kiya.telegram.deliveries.length === 2,
    "calendar-worthy dry-run should include two Telegram deliveries"
  );
  const localVoiceKiyaLog = await readJsonFile(
    path.join(
      storageDir,
      "sessions",
      localVoice.sessionId,
      "agent",
      "kiya-notification.latest.json"
    )
  );
  assert(
    localVoiceKiyaLog.hermes.calendarProposal?.detected === true,
    "calendar-worthy Kiya proposal should be persisted"
  );

  const calendarResult = await postJson(
    `/api/sessions/${localVoice.sessionId}/kiya-calendar-result`,
    {
      status: "created",
      title: "ixi-O Agent smoke follow-up",
      startsAt: "2026-05-31T15:00:00+09:00",
      note: "smoke test calendar audit callback"
    },
    {
      accept: "application/json"
    }
  );
  assert(calendarResult.ok === true, "Kiya calendar result callback should succeed");
  const calendarResultLog = await readJsonFile(
    path.join(
      storageDir,
      "sessions",
      localVoice.sessionId,
      "agent",
      "kiya-calendar-result.latest.json"
    )
  );
  assert(
    calendarResultLog.status === "created",
    "Kiya calendar result callback should be persisted"
  );

  const kiyaManual = await postJson(`/api/sessions/${sessionId}/notify-kiya`, undefined, {
    accept: "application/json"
  });
  assert(kiyaManual.ok === true, "manual Kiya notification route should succeed");
  assert(
    kiyaManual.result.telegram.status === "dry_run",
    "manual Kiya notification should dry-run without credentials"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId,
        localVoiceSessionId: localVoice.sessionId,
        storageDir,
        checks: [
          "server_started",
          "sample_ingested",
          "fallback_local_processed",
          "miso_blocked_before_review",
          "miso_available_after_review",
          "local_voice_frontdoor_ingested",
          "kiya_notification_log_written",
          "kiya_auto_notification_dry_run",
          "kiya_manual_notification_dry_run",
          "kiya_calendar_proposal_dry_run",
          "kiya_calendar_result_callback_logged"
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
  if ((process.env.IXI_O_AGENT_SMOKE_KEEP_TMP ?? process.env.PHONE_CLAW_SMOKE_KEEP_TMP) !== "1") {
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
      "x-ixi-o-agent-ingest-secret": ingestSecret,
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

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`assertion_failed:${message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
