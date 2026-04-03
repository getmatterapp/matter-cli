// TUI entry point — uses @opentui/react (React reconciler over native Zig rendering core).
// Fallback: if OpenTUI has blocking issues, swap to `ink` + `@inkjs/ui` — same JSX model.

import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import { useState, useCallback } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { MatterAPI } from "../api.js";
import { loadConfig } from "../config.js";
import { VERSION } from "../version.js";
import { theme, getColorMode, setColorMode, applyColorMode, type ColorMode } from "./theme.js";
import { CommandPalette } from "./CommandPalette.js";
import { ItemList } from "./ItemList.js";
import { ItemCard } from "./ItemCard.js";
import { ResultsView } from "./ResultsView.js";
import { Settings } from "./Settings.js";

type View =
  | { name: "palette" }
  | { name: "items"; status?: string }
  | { name: "item"; id: string }
  | { name: "results"; title: string; data: unknown }
  | { name: "settings" };

function App() {
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const config = loadConfig();
  const api = new MatterAPI(config.access_token!);

  const [view, setView] = useState<View>({ name: "palette" });
  const [history, setHistory] = useState<View[]>([]);

  const navigate = useCallback(
    (next: View) => {
      setHistory((prev) => [...prev, view]);
      setView(next);
    },
    [view],
  );

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) {
        renderer.destroy();
        return prev;
      }
      const next = [...prev];
      const last = next.pop()!;
      setView(last);
      return next;
    });
  }, [renderer]);

  const [colorMode, setColorModeState] = useState<ColorMode>(getColorMode);
  const cycleColorMode = useCallback(() => {
    const modes: ColorMode[] = ["system", "dark", "light"];
    const next = modes[(modes.indexOf(colorMode) + 1) % modes.length];
    setColorMode(next);
    applyColorMode(next);
    setColorModeState(next);
  }, [colorMode]);

  useKeyboard((event) => {
    if (event.name === "q") {
      renderer.destroy();
    } else if (event.name === "escape") {
      goBack();
    } else if (event.name === "d") {
      cycleColorMode();
    }
  });

  const statusBar = (
    <box
      flexDirection="row"
      height={1}
      width="100%"
      backgroundColor={theme.bg.bar}
    >
      <text fg={theme.accent}> matter v{VERSION} </text>
      <box flexGrow={1} />
      <text fg={theme.fg.dim}>
        q:quit{view.name !== "palette" ? " | esc:back" : ""} | j/k:nav | d:{colorMode} theme | enter:select
      </text>
    </box>
  );

  let content;
  switch (view.name) {
    case "palette":
      content = (
        <CommandPalette
          onSelect={(cmd) => {
            switch (cmd) {
              case "items-inbox":
                navigate({ name: "items", status: "inbox" });
                break;
              case "items-queue":
                navigate({ name: "items", status: "queue" });
                break;
              case "items-archive":
                navigate({ name: "items", status: "archive" });
                break;
              case "items-all":
                navigate({ name: "items" });
                break;
              case "settings":
                navigate({ name: "settings" });
                break;
              default:
                break;
            }
          }}
        />
      );
      break;

    case "items":
      content = (
        <ItemList
          api={api}
          status={view.status}
          onSelect={(id) => navigate({ name: "item", id })}
        />
      );
      break;

    case "item":
      content = (
        <ItemCard
          api={api}
          itemId={view.id}
          onNavigate={(next) => navigate(next as View)}
        />
      );
      break;

    case "results":
      content = <ResultsView title={view.title} data={view.data} />;
      break;

    case "settings":
      content = <Settings />;
      break;
  }

  return (
    <box flexDirection="column" width="100%" height="100%">
      {statusBar}
      <box flexGrow={1} flexDirection="column">
        {content}
      </box>
    </box>
  );
}

export async function launchTUI(): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  createRoot(renderer).render(<App />);
}
