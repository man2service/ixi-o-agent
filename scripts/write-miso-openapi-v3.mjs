#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(rootDir, "miso", "ixi-o-agent-openapi.json");
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(rootDir, "miso", "ixi-o-agent-openapi.v3.json");

const spec = JSON.parse(readFileSync(sourcePath, "utf8"));
spec.openapi = "3.0.3";
convertJsonSchemaToOpenApi30(spec);
writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
console.log(outputPath);

function convertJsonSchemaToOpenApi30(value) {
  if (Array.isArray(value)) {
    for (const item of value) convertJsonSchemaToOpenApi30(item);
    return;
  }

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value.type)) {
    const nonNullTypes = value.type.filter((item) => item !== "null");
    value.type = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes;
    if (value.type === "null" || value.type.length === 0) {
      value.type = "string";
    }
    if (value.type.includes?.("null")) {
      value.type = value.type.filter((item) => item !== "null");
    }
    value.nullable = true;
  }

  if (Object.prototype.hasOwnProperty.call(value, "const")) {
    value.enum = [value.const];
    delete value.const;
  }

  for (const child of Object.values(value)) {
    convertJsonSchemaToOpenApi30(child);
  }
}
