import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { loadConfig, saveConfig } from "../config.js";
import { VERSION } from "../version.js";
import { theme, getColorMode, setColorMode, applyColorMode, type ColorMode } from "./theme.js";

export function Settings() {
  const [config, setConfig] = useState(loadConfig);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const [colorMode, setColorModeState] = useState<ColorMode>(getColorMode);

  const cycleColorMode = () => {
    const modes: ColorMode[] = ["system", "dark", "light"];
    const next = modes[(modes.indexOf(colorMode) + 1) % modes.length];
    setColorMode(next);
    applyColorMode(next);
    setColorModeState(next);
    setMessage(`Color mode: ${next}`);
  };

  const items = [
    {
      label: "Readonly Mode",
      value: config.readonly ? "ON" : "OFF",
      toggle: () => {
        const updated = { ...config, readonly: !config.readonly };
        saveConfig(updated);
        setConfig(updated);
        setMessage(`Readonly mode ${updated.readonly ? "enabled" : "disabled"}`);
      },
    },
    {
      label: "Color Mode",
      value: colorMode,
      toggle: cycleColorMode,
    },
    {
      label: "Auth Token",
      value: config.access_token ? `${config.access_token.slice(0, 8)}...` : "Not set",
      toggle: () => {},
    },
    {
      label: "Version",
      value: VERSION,
      toggle: () => {},
    },
  ];

  useKeyboard((event) => {
    if (event.name === "up" || event.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (event.name === "down" || event.name === "j") {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (event.name === "return") {
      items[selectedIndex].toggle();
    }
  });

  return (
    <box flexDirection="column" padding={1}>
      <text fg={theme.accent}>
        <b>Settings</b>
      </text>
      <box height={1} />
      {items.map((item, i) => {
        const isSelected = i === selectedIndex;
        return (
          <box key={item.label} flexDirection="row">
            <text fg={isSelected ? theme.accent : theme.fg.ghost}>
              {isSelected ? " > " : "   "}
            </text>
            <text fg={isSelected ? theme.fg.primary : theme.fg.tertiary}>
              {item.label.padEnd(20)}
            </text>
            <text fg={theme.success}>{item.value}</text>
          </box>
        );
      })}
      {message != null ? (
        <box flexDirection="column">
          <box height={1} />
          <text fg={theme.success}>{message}</text>
        </box>
      ) : null}
    </box>
  );
}
