import { execSync } from "child_process";
import { createWriteStream, chmodSync, renameSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { VERSION } from "./version.js";
import { loadConfig, saveConfig } from "./config.js";

const GITHUB_REPO = "hclarke/matter-cli";

interface ReleaseInfo {
  version: string;
  tag: string;
  downloadUrl: string;
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

export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
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
  if (latestVersion === VERSION) {
    return null;
  }

  const binaryName = getPlatformBinary();
  const asset = release.assets.find((a) => a.name === binaryName);
  if (!asset) {
    throw new Error(`No binary found for this platform (${binaryName})`);
  }

  return {
    version: latestVersion,
    tag: release.tag_name,
    downloadUrl: asset.browser_download_url,
    notes: release.body || "",
  };
}

export async function performUpdate(release: ReleaseInfo): Promise<void> {
  const res = await fetch(release.downloadUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download update: HTTP ${res.status}`);
  }

  const tmpPath = join(tmpdir(), `matter-update-${Date.now()}`);
  const writeStream = createWriteStream(tmpPath);
  await pipeline(Readable.fromWeb(res.body as any), writeStream);

  chmodSync(tmpPath, 0o755);

  // Find current binary path
  const currentBinary = process.argv[0];
  const backupPath = `${currentBinary}.bak`;

  try {
    renameSync(currentBinary, backupPath);
    renameSync(tmpPath, currentBinary);
    try {
      unlinkSync(backupPath);
    } catch {
      // Best effort cleanup
    }
  } catch (err) {
    // Try to restore backup
    try {
      renameSync(backupPath, currentBinary);
    } catch {
      // Give up
    }
    throw new Error(`Failed to replace binary: ${(err as Error).message}`);
  }
}

export async function backgroundUpdateCheck(): Promise<void> {
  try {
    const config = loadConfig();
    const lastCheck = config.last_update_check;

    if (lastCheck) {
      const elapsed = Date.now() - new Date(lastCheck).getTime();
      if (elapsed < 24 * 60 * 60 * 1000) return;
    }

    config.last_update_check = new Date().toISOString();
    saveConfig(config);

    const latest = await checkForUpdate();
    if (latest) {
      console.error(`A new version of matter is available (v${latest.version}). Run 'matter update' to upgrade.`);
    }
  } catch {
    // Silently ignore — never block main execution
  }
}
