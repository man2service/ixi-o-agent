import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(new URL("..", import.meta.url).pathname);
const appRoot = path.join(workspaceRoot, "apps", "local-web");
const port = Number.parseInt(process.env.IXI_O_AGENT_EXAONE_SMOKE_PORT ?? "3211", 10);
const baseUrl = `http://localhost:${port}`;
const ingestSecret = "ixi-o-agent-exaone-smoke-secret";
const modelPath = path.resolve(
  process.env.IXI_O_AGENT_EXAONE_MODEL_PATH ??
    process.env.PHONE_CLAW_EXAONE_MODEL_PATH ??
    path.join(workspaceRoot, "models", "exaone", "EXAONE-4.0-1.2B-Q4_K_M.gguf")
);
const llamaCli =
  process.env.IXI_O_AGENT_LLAMA_CLI ?? process.env.PHONE_CLAW_LLAMA_CLI ?? "llama-cli";
const tempRoot = await mkdtemp(path.join(tmpdir(), "ixi-o-agent-exaone-smoke-"));
const storageDir = path.join(tempRoot, "private-voice-inbox");

let server;

try {
  await assertReadable(modelPath, "exaone_model_not_readable");
  assertCommandAvailable(llamaCli);

  server = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], {
    cwd: appRoot,
    env: {
      ...process.env,
      IXI_O_AGENT_STORAGE_DIR: storageDir,
      PHONE_CLAW_STORAGE_DIR: storageDir,
      IXI_O_AGENT_INGEST_SECRET: ingestSecret,
      PHONE_CLAW_INGEST_SECRET: ingestSecret,
      IXI_O_AGENT_EXAONE_MODEL_PATH: modelPath,
      PHONE_CLAW_EXAONE_MODEL_PATH: modelPath,
      IXI_O_AGENT_LLAMA_CLI: llamaCli,
      PHONE_CLAW_LLAMA_CLI: llamaCli,
      IXI_O_AGENT_EXAONE_TIMEOUT_MS: process.env.IXI_O_AGENT_EXAONE_TIMEOUT_MS ?? "120000",
      IXI_O_AGENT_KIYA_AUTO_NOTIFY: "false",
      PHONE_CLAW_KIYA_AUTO_NOTIFY: "false"
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

  const payload = JSON.parse(
    await readFile(path.join(workspaceRoot, "sample-data", "channel-talk-normalized.json"), "utf8")
  );
  payload.transcript = [
    {
      speaker: "customer",
      text: "고객이 내일 오전까지 견적서를 요청했고, 내부 검토 후 담당자가 회신하기로 했다.",
      timestampMs: 0
    },
    {
      speaker: "manager",
      text: "추가로 다음 주 화요일 오후에 후속 미팅 일정을 잡아 달라고 요청했다.",
      timestampMs: 9000
    }
  ];

  const ingest = await postJson("/api/ingest/channel-talk", payload);
  assert(ingest.ok === true, "sample ingest should succeed");
  assert(typeof ingest.sessionId === "string", "sample ingest should return sessionId");

  const processResult = await postJson(`/api/sessions/${ingest.sessionId}/process`, undefined);
  assert(processResult.ok === true, "EXAONE process route should succeed");
  assert(
    processResult.result.engine === "exaone-local",
    `expected exaone-local, got ${processResult.result.engine}`
  );
  assert(processResult.result.modelAvailable === true, "EXAONE model should be available");
  assert(Boolean(processResult.result.summary), "EXAONE result should include summary");
  assert(
    Array.isArray(processResult.result.actionItems),
    "EXAONE result should include actionItems array"
  );

  const detail = await getJson(`/api/sessions/${ingest.sessionId}`);
  assert(
    detail.session.exaone?.engine === "exaone-local",
    "session detail should persist exaone-local engine"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId: ingest.sessionId,
        engine: processResult.result.engine,
        modelAvailable: processResult.result.modelAvailable,
        modelPath: processResult.result.modelPath,
        summaryPreview: processResult.result.summary.slice(0, 160),
        actionItemCount: processResult.result.actionItems.length,
        storageDir,
        checks: [
          "server_started",
          "sample_ingested",
          "exaone_local_processed",
          "exaone_result_persisted"
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
  if (process.env.IXI_O_AGENT_EXAONE_SMOKE_KEEP_TMP !== "1") {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function assertReadable(filePath, code) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${code}:${filePath}`);
  }
}

function assertCommandAvailable(command) {
  const result = spawnSync(command, ["--help"], { stdio: "ignore" });
  if (result.error?.code === "ENOENT") {
    throw new Error(`llama_cli_not_found:${command}`);
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
  throw new Error(
    `server_start_timeout:${lastError?.message ?? "unknown"}:${logs.join("").slice(-1000)}`
  );
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
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
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
