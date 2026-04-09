import { createWriteStream, chmodSync, renameSync, unlinkSync, readFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { VERSION } from "./version.js";
import { loadConfig, saveConfig, CONFIG_DIR } from "./config.js";

const GITHUB_REPO = "getmatterapp/matter-cli";
const FETCH_TIMEOUT_MS = 30_000;

interface ReleaseInfo {
  version: string;
  tag: string;
  downloadUrl: string;
  checksumUrl: string | null;
  notes: string;
}

function getPlatformBinary(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") return "matter-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "matter-darwin-x64";
  if (platform === "linux" && arch === "arm64") return "matter-linux-arm64";
  if (platform === "linux" && arch === "x64") return "matter-linux-x64";
  if (platform === "win32" && arch === "x64") return "matter-windows-x64.exe";
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

/** Compare semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b. */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  const res = await fetchWithTimeout(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to check for updates: HTTP ${res.status}`);
  }

  const release = (await res.json()) as {
    tag_name: string;
    body: string;
    assets: { name: string; browser_download_url: string }[];
  };

  const latestVersion = release.tag_name.replace(/^v/, "");
  if (compareSemver(latestVersion, VERSION) <= 0) {
    return null;
  }

  const binaryName = getPlatformBinary();
  const asset = release.assets.find((a) => a.name === binaryName);
  if (!asset) {
    throw new Error(`No binary found for this platform (${binaryName})`);
  }

  const checksumAsset = release.assets.find((a) => a.name === "checksums.txt");

  return {
    version: latestVersion,
    tag: release.tag_name,
    downloadUrl: asset.browser_download_url,
    checksumUrl: checksumAsset?.browser_download_url ?? null,
    notes: release.body || "",
  };
}

async function verifyChecksum(filePath: string, release: ReleaseInfo): Promise<void> {
  if (!release.checksumUrl) return;

  const res = await fetchWithTimeout(release.checksumUrl);
  if (!res.ok) {
    throw new Error(`Failed to download checksums: HTTP ${res.status}`);
  }

  const checksumText = await res.text();
  const binaryName = getPlatformBinary();

  // checksums.txt format: "<hash>  <path>/matter-*" — find line matching our binary
  const line = checksumText.split("\n").find((l) => l.includes(binaryName));
  if (!line) {
    throw new Error(`No checksum found for ${binaryName}`);
  }

  const expectedHash = line.trim().split(/\s+/)[0];
  const fileBuffer = readFileSync(filePath);
  const actualHash = createHash("sha256").update(fileBuffer).digest("hex");

  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum mismatch for ${binaryName}.\n  Expected: ${expectedHash}\n  Got:      ${actualHash}`,
    );
  }
}

function tryUnlink(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Best effort
  }
}

export async function performUpdate(release: ReleaseInfo): Promise<void> {
  const res = await fetchWithTimeout(release.downloadUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download update: HTTP ${res.status}`);
  }

  const tmpPath = join(tmpdir(), `matter-update-${Date.now()}`);

  try {
    const writeStream = createWriteStream(tmpPath);
    await pipeline(Readable.fromWeb(res.body as any), writeStream);
    chmodSync(tmpPath, 0o755);

    await verifyChecksum(tmpPath, release);
  } catch (err) {
    tryUnlink(tmpPath);
    throw err;
  }

  // Replace the running binary
  const currentBinary = process.execPath;
  const backupPath = `${currentBinary}.bak`;

  try {
    renameSync(currentBinary, backupPath);
    renameSync(tmpPath, currentBinary);
    tryUnlink(backupPath);
  } catch (err) {
    // Try to restore from backup
    try {
      renameSync(backupPath, currentBinary);
    } catch {
      console.error(
        `CRITICAL: Failed to restore binary. Your backup is at ${backupPath}\n` +
          `The downloaded update is at ${tmpPath}\n` +
          `Manually move one of them to ${currentBinary} to recover.`,
      );
    }
    tryUnlink(tmpPath);
    throw new Error(`Failed to replace binary: ${(err as Error).message}`);
  }
}

const STAGING_PATH = join(CONFIG_DIR, "matter-staged");

/** Download update binary to staging location. Runs in background, never throws. */
export async function backgroundDownloadUpdate(): Promise<void> {
  try {
    const config = loadConfig();

    // Skip if we already have a pending update staged
    if (config.pending_update && existsSync(config.pending_update.path)) {
      return;
    }

    const latest = await checkForUpdate();
    if (!latest) return;

    // Download to staging
    const res = await fetchWithTimeout(latest.downloadUrl);
    if (!res.ok || !res.body) return;

    const writeStream = createWriteStream(STAGING_PATH);
    await pipeline(Readable.fromWeb(res.body as any), writeStream);
    chmodSync(STAGING_PATH, 0o755);

    await verifyChecksum(STAGING_PATH, latest);

    // Save pending update to config
    config.pending_update = {
      version: latest.version,
      path: STAGING_PATH,
      downloaded_at: new Date().toISOString(),
    };
    saveConfig(config);
  } catch {
    // Clean up failed download
    tryUnlink(STAGING_PATH);
    // Silently ignore — never block main execution
  }
}

/** Apply a previously staged update. Call early in startup, before command parsing. */
export function applyPendingUpdate(): void {
  try {
    const config = loadConfig();
    if (!config.pending_update) return;

    const { version, path: stagedPath } = config.pending_update;

    if (!existsSync(stagedPath)) {
      // Staged binary missing — clear stale config
      delete config.pending_update;
      saveConfig(config);
      return;
    }

    // Swap the running binary
    const currentBinary = process.execPath;
    const backupPath = `${currentBinary}.bak`;

    renameSync(currentBinary, backupPath);
    renameSync(stagedPath, currentBinary);
    tryUnlink(backupPath);

    // Clear pending state
    delete config.pending_update;
    saveConfig(config);

    console.error(`Updated matter to v${version}.`);
  } catch {
    // Failed to apply — will retry next run. Don't block startup.
  }
}

/** Remove staged binary and clear pending_update from config. */
export function clearPendingUpdate(): void {
  tryUnlink(STAGING_PATH);
  const config = loadConfig();
  if (config.pending_update) {
    delete config.pending_update;
    saveConfig(config);
  }
}
