#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const useV3 = args.includes("--v3");
const serverUrl = args.find((arg) => !arg.startsWith("--")) ?? process.env.IXI_O_AGENT_MISO_SERVER_URL;

if (!serverUrl) {
  console.error(
    "Usage: node scripts/write-miso-openapi-for-server.mjs https://<tunnel-host>"
  );
  process.exit(1);
}

const normalizedServerUrl = serverUrl.replace(/\/$/, "");
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  rootDir,
  "miso",
  useV3 ? "ixi-o-agent-openapi.v3.json" : "ixi-o-agent-openapi.json"
);
const outputDir = path.join(rootDir, "miso", "generated");
const outputPath = path.join(
  outputDir,
  useV3 ? "ixi-o-agent-openapi.current-tunnel.v3.json" : "ixi-o-agent-openapi.current-tunnel.json"
);

const spec = JSON.parse(readFileSync(sourcePath, "utf8"));
spec.servers = [
  {
    url: normalizedServerUrl,
    description:
      "Current externally reachable ixi-O Agent endpoint for MISO judging setup. Regenerate when the tunnel restarts."
  }
];

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

console.log(outputPath);
