import { useState, useMemo } from "react";
import { useKeyboard } from "@opentui/react";

interface Command {
  id: string;
  label: string;
  group: string;
}

const COMMANDS: Command[] = [
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
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!filter) return COMMANDS;
    const lower = filter.toLowerCase();
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(lower) ||
        c.group.toLowerCase().includes(lower),
    );
  }, [filter]);

  useKeyboard((event) => {
    if (event.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (event.name === "down") {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.name === "return") {
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].id);
      }
    } else if (event.name === "backspace") {
      setFilter((f) => f.slice(0, -1));
      setSelectedIndex(0);
    } else if (event.raw && event.raw.length === 1 && event.raw >= " ") {
      setFilter((f) => f + event.raw);
      setSelectedIndex(0);
    }
  });

  let currentGroup = "";

  return (
    <box flexDirection="column" padding={1}>
      <text fg="#7b68ee">
        <b>Command Palette</b>
      </text>
      <box height={1} />
      <box flexDirection="row">
        <text fg="#888">/ </text>
        <text fg="#fff">{filter || " "}</text>
        <text fg="#444">_</text>
      </box>
      <box height={1} />
      {filtered.map((cmd, i) => {
        const showGroup = cmd.group !== currentGroup;
        currentGroup = cmd.group;
        const isSelected = i === selectedIndex;

        return (
          <box key={cmd.id} flexDirection="column">
            {showGroup && (
              <text fg="#555">{cmd.group}</text>
            )}
            <box flexDirection="row">
              <text fg={isSelected ? "#7b68ee" : "#444"}>
                {isSelected ? " > " : "   "}
              </text>
              <text
                fg={isSelected ? "#fff" : "#aaa"}
                bg={isSelected ? "#2a2a4e" : undefined}
              >
                {cmd.label}
              </text>
            </box>
          </box>
        );
      })}
      {filtered.length === 0 && (
        <text fg="#666">No matching commands</text>
      )}
    </box>
  );
}
