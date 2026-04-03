import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { theme } from "./theme.js";

interface Command {
  id: string;
  label: string;
  group: string;
}

const COMMANDS: Command[] = [
  { id: "search", label: "Search", group: "Search" },
  { id: "items-inbox", label: "Browse Inbox", group: "Items" },
  { id: "items-queue", label: "Browse Queue", group: "Items" },
  { id: "items-archive", label: "Browse Archive", group: "Items" },
  { id: "items-all", label: "Browse All Items", group: "Items" },
  { id: "settings", label: "Settings", group: "CLI" },
];


interface CommandPaletteProps {
  onSelect: (commandId: string) => void;
}

export function CommandPalette({ onSelect }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard((event) => {
    if (event.name === "up" || event.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (event.name === "down" || event.name === "j") {
      setSelectedIndex((i) => Math.min(COMMANDS.length - 1, i + 1));
    } else if (event.name === "return") {
      onSelect(COMMANDS[selectedIndex].id);
    } else if (event.raw === "/") {
      onSelect("search");
    }
  });

  let currentGroup = "";

  return (
    <box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
      <box flexDirection="column">
        <ascii-font text="matter" font="block" color={theme.fg.primary} />
        <text fg={theme.fg.dim}><i>Words are my matter.</i> —Ursula K. Le Guin</text>
        <box height={1} />
        {COMMANDS.map((cmd, i) => {
          const showGroup = cmd.group !== currentGroup;
          currentGroup = cmd.group;
          const isSelected = i === selectedIndex;

          return (
            <box key={cmd.id} flexDirection="column">
              {showGroup && i > 0 && <box height={1} />}
              {showGroup && <text fg={theme.fg.faint}>{cmd.group}</text>}
              <box flexDirection="row">
                <text fg={isSelected ? theme.accent : theme.fg.ghost}>
                  {isSelected ? " > " : "   "}
                </text>
                <text
                  fg={isSelected ? theme.fg.primary : theme.fg.tertiary}
                  bg={isSelected ? theme.bg.selected : undefined}
                >
                  {cmd.label}
                </text>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
