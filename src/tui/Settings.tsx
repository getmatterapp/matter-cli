import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { loadConfig, saveConfig } from "../config.js";
import { VERSION } from "../version.js";

export function Settings() {
  const [config, setConfig] = useState(loadConfig);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

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
    if (event.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (event.name === "down") {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (event.name === "return") {
      items[selectedIndex].toggle();
    }
  });

  return (
    <box flexDirection="column" padding={1}>
      <text fg="#7b68ee">
        <b>Settings</b>
      </text>
      <box height={1} />
      {items.map((item, i) => {
        const isSelected = i === selectedIndex;
        return (
          <box key={item.label} flexDirection="row">
            <text fg={isSelected ? "#7b68ee" : "#444"}>
              {isSelected ? " > " : "   "}
            </text>
            <text fg={isSelected ? "#fff" : "#aaa"}>
              {item.label.padEnd(20)}
            </text>
            <text fg="#4ecdc4">{item.value}</text>
          </box>
        );
      })}
      {message != null ? (
        <box flexDirection="column">
          <box height={1} />
          <text fg="#4ecdc4">{message}</text>
        </box>
      ) : null}
    </box>
  );
}
