import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

export interface Config {
  access_token?: string;
  auth_type?: "token";
  readonly: boolean;
  color_mode?: "dark" | "light" | "system";
  last_update_check?: string;
  version?: string;
}

const CONFIG_DIR = join(homedir(), ".config", "matter");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: Config = {
  readonly: false,
};

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function getToken(): string | undefined {
  return loadConfig().access_token;
}

export function requireToken(): string {
  const token = getToken();
  if (!token) {
    console.error("Not logged in. Run `matter login` or `matter login-with-token` first.");
    process.exit(1);
  }
  return token;
}

export function isReadonly(): boolean {
  return loadConfig().readonly;
}

export function requireWritable(): void {
  if (isReadonly()) {
    console.error("Readonly mode is enabled. Disable it in settings or re-authenticate to allow write operations.");
    process.exit(1);
  }
}
