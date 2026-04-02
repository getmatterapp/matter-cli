import { loadConfig, saveConfig } from "./config.js";
import { VERSION } from "./version.js";

const API_BASE = "https://api.getmatter.com/public/v1";

export async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed.startsWith("mat_")) {
    throw new Error("Invalid token format. Matter API tokens start with 'mat_'.");
  }

  const valid = await validateToken(trimmed);
  if (!valid) {
    throw new Error("Token validation failed. Check that the token is correct and try again.");
  }

  const config = loadConfig();
  config.access_token = trimmed;
  config.auth_type = "token";
  config.version = VERSION;
  saveConfig(config);
}

export async function promptForToken(): Promise<string> {
  // Check if input is being piped
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8").trim();
  }

  // Interactive hidden input
  process.stdout.write("Enter your Matter API token: ");
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let input = "";
    const onData = (char: string) => {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "\u0003") {
        // Ctrl+C
        stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(130);
      } else if (char === "\u007F" || char === "\b") {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += char;
      }
    };
    stdin.on("data", onData);
  });
}
