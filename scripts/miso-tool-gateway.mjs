#!/usr/bin/env node
import http from "node:http";

const port = Number.parseInt(process.env.IXI_O_AGENT_MISO_GATEWAY_PORT ?? "3321", 10);
const upstreamUrl = (process.env.IXI_O_AGENT_MISO_UPSTREAM_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
const upstreamSecret =
  process.env.IXI_O_AGENT_INGEST_SECRET ?? process.env.PHONE_CLAW_INGEST_SECRET;
const gatewayToken = process.env.IXI_O_AGENT_MISO_GATEWAY_TOKEN;

if (!upstreamSecret) {
  console.error("IXI_O_AGENT_INGEST_SECRET is required.");
  process.exit(1);
}

if (!gatewayToken) {
  console.error("IXI_O_AGENT_MISO_GATEWAY_TOKEN is required. Use a short-lived token for MISO.");
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method !== "GET" || !isAllowedMisoPath(url.pathname)) {
      return sendJson(response, 404, { ok: false, error: "not_found" });
    }

    const token = readBearerToken(request.headers.authorization);
    if (token !== gatewayToken) {
      return sendJson(response, 401, { ok: false, error: "unauthorized" });
    }

    const upstream = await fetch(`${upstreamUrl}${url.pathname}${url.search}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${upstreamSecret}`
      },
      signal: AbortSignal.timeout(15_000)
    });
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();
    response.writeHead(upstream.status, {
      "content-type": contentType,
      "cache-control": "no-store"
    });
    response.end(body);
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      error: "gateway_upstream_error",
      message: error instanceof Error ? error.message : "unknown_error"
    });
  }
});

server.listen(port, () => {
  console.log(
    JSON.stringify({
      ok: true,
      service: "ixi-o-agent-miso-tool-gateway",
      port,
      upstreamUrl,
      allowedPaths: ["/api/miso/voice-sessions", "/api/miso/voice-sessions/{sessionId}"]
    })
  );
});

function isAllowedMisoPath(pathname) {
  return (
    pathname === "/api/miso/voice-sessions" ||
    /^\/api\/miso\/voice-sessions\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(pathname)
  );
}

function readBearerToken(value) {
  if (!value) return undefined;
  const [scheme, token] = value.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}
