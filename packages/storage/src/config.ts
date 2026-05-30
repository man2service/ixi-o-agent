import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type LocalConfig = {
  storageDir?: string;
};

export function getWorkspaceRoot(startDir = process.cwd()): string {
  let current = startDir;
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

export function getStorageDir(): string {
  const root = getWorkspaceRoot();
  const envDir = process.env.PHONE_CLAW_STORAGE_DIR;
  if (envDir) {
    return path.resolve(root, envDir);
  }

  const configPath = path.join(root, "config", "local.json");
  if (existsSync(configPath)) {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as LocalConfig;
    if (parsed.storageDir) {
      return path.resolve(root, parsed.storageDir);
    }
  }

  return path.join(root, "private-voice-inbox");
}

