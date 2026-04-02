import { execSync } from "child_process";
import { loadConfig, saveConfig, type Config } from "../config.js";

export type ColorMode = "dark" | "light" | "system";

interface Theme {
  accent: string;
  success: string;
  warning: string;
  error: string;
  highlight: { bg: string; fg: string };
  bg: { bar: string; selected: string };
  border: string;
  fg: {
    primary: string;
    content: string;
    secondary: string;
    tertiary: string;
    muted: string;
    dim: string;
    faint: string;
    ghost: string;
  };
}

const dark: Theme = {
  accent: "#7b68ee",
  success: "#4ecdc4",
  warning: "#ffd93d",
  error: "#ff4444",
  highlight: { bg: "#6a6226", fg: "#fff" },
  bg: { bar: "#1a1a2e", selected: "#2a2a4e" },
  border: "#333",
  fg: {
    primary: "#fff",
    content: "#ddd",
    secondary: "#ccc",
    tertiary: "#aaa",
    muted: "#888",
    dim: "#666",
    faint: "#555",
    ghost: "#444",
  },
};

const light: Theme = {
  accent: "#5b4bd6",
  success: "#0e8a7d",
  warning: "#b8860b",
  error: "#cc2222",
  highlight: { bg: "#fff8c6", fg: "#111" },
  bg: { bar: "#e8e8f0", selected: "#eeeef5" },
  border: "#ccc",
  fg: {
    primary: "#111",
    content: "#222",
    secondary: "#333",
    tertiary: "#555",
    muted: "#777",
    dim: "#999",
    faint: "#aaa",
    ghost: "#bbb",
  },
};

function detectSystemMode(): "dark" | "light" {
  // macOS: check AppleInterfaceStyle
  if (process.platform === "darwin") {
    try {
      execSync("defaults read -g AppleInterfaceStyle", { stdio: "pipe" });
      return "dark";
    } catch {
      return "light";
    }
  }

  // COLORFGBG is set by some terminals (e.g. xterm, rxvt)
  // Format: "fg;bg" — high bg number means light background
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const bg = parseInt(colorfgbg.split(";").pop() ?? "", 10);
    if (!isNaN(bg) && bg > 6) return "light";
  }

  return "dark";
}

function resolveMode(mode: ColorMode): "dark" | "light" {
  return mode === "system" ? detectSystemMode() : mode;
}

export function getColorMode(): ColorMode {
  return loadConfig().color_mode ?? "system";
}

export function setColorMode(mode: ColorMode): void {
  const config = loadConfig();
  config.color_mode = mode;
  saveConfig(config);
}

export let theme: Theme = resolveMode(getColorMode()) === "dark" ? dark : light;

export function applyColorMode(mode: ColorMode): void {
  theme = resolveMode(mode) === "dark" ? dark : light;
}

// Initialize on import
applyColorMode(getColorMode());

export function statusColor(status: string): string {
  switch (status) {
    case "queue":
      return theme.success;
    case "inbox":
      return theme.warning;
    default:
      return theme.fg.muted;
  }
}
