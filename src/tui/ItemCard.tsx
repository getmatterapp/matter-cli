import { useState, useEffect, useRef, useCallback } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { SyntaxStyle, RGBA } from "@opentui/core";
import type { MatterAPI, Item, Annotation } from "../api.js";
import { theme, statusColor } from "./theme.js";

interface ItemCardProps {
  api: MatterAPI;
  itemId: string;
  onNavigate: (view: unknown) => void;
}

const hex = RGBA.fromHex;
const syntaxStyle = SyntaxStyle.fromStyles({
  "markup.heading": { fg: hex(theme.accent), bold: true },
  "markup.strong": { bold: true },
  "markup.italic": { italic: true },
  "markup.link.label": {},
  "markup.link.url": { fg: hex(theme.fg.dim) },
  "markup.link": { fg: hex(theme.fg.dim) },  // parens around URL
  "markup.strikethrough": { dim: true },
  "conceal": { fg: hex(theme.fg.ghost) },
});

// Matter's API returns markdown with backslash-escaped punctuation
// (e.g. \-, \(, \), \~, \!) which is valid markdown but renders
// poorly in terminal. Strip these escapes before display.
function prepMarkdown(md: string): string {
  return md
    .replace(/\\([^\n])/g, "$1")    // unescape all backslash-escaped chars
    .replace(/\u200b/g, "")         // strip zero-width spaces
    .replace(/^(?:> ?)+(.*)$/gm, (_, text) => text ? `*${text}*` : "");  // pullquotes: render as italic
}

function NotebookPanel({ annotations }: { annotations: Annotation[] }) {
  if (annotations.length === 0) {
    return (
      <box padding={1} flexDirection="column">
        <text fg={theme.fg.dim}>No highlights yet.</text>
      </box>
    );
  }

  return (
    <scrollbox flexGrow={1} focused>
      <box padding={1} flexDirection="column">
        <text fg={theme.fg.secondary}>
          <b>{`Notebook (${annotations.length})`}</b>
        </text>
        <box height={1} />
        {annotations.map((ann) => (
          <box key={ann.id} flexDirection="column">
            <box flexDirection="row">
              <text fg={theme.accent}>{"│ "}</text>
              <text fg={theme.fg.content}>{ann.text}</text>
            </box>
            {ann.note != null && ann.note !== "" ? (
              <box flexDirection="row">
                <text fg={theme.accent}>{"  "}</text>
                <text fg={theme.fg.muted}><i>{ann.note}</i></text>
              </box>
            ) : null}
            <box height={1} />
          </box>
        ))}
      </box>
    </scrollbox>
  );
}

export function ItemCard({ api, itemId }: ItemCardProps) {
  const { width, height } = useTerminalDimensions();
  const [item, setItem] = useState<Item | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const progressRef = useRef(0);

  const actions = [
    // e = archive (always available), s = save to queue (when not in queue)
    ...(item?.status !== "queue"
      ? [{ key: "s", label: "Save", action: () => updateStatus("queue") }]
      : []),
    ...(item?.status !== "archive"
      ? [{ key: "e", label: "Archive", action: () => updateStatus("archive") }]
      : []),
    item?.is_favorite
      ? { key: "f", label: "Unfav", action: () => toggleFavorite() }
      : { key: "f", label: "Fav", action: () => toggleFavorite() },
    ...(annotations.length > 0
      ? [{ key: "n", label: notebookOpen ? "Close" : `Notebook (${annotations.length})`, action: () => setNotebookOpen((v) => !v) }]
      : []),
    ...(item?.markdown ? [{ key: "w", label: "Web", action: () => openInApp() }] : []),
    ...(item?.url ? [{ key: "b", label: "Browser", action: () => openInBrowser() }] : []),
  ];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [itemData, annData] = await Promise.all([
          api.getItem(itemId, "markdown"),
          api.listAnnotations({ item_id: itemId }),
        ]);
        setItem(itemData);
        setAnnotations(annData.results);
        progressRef.current = itemData.reading_progress;
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [api, itemId]);

  async function updateStatus(status: "queue" | "archive") {
    if (!item) return;
    try {
      const updated = await api.updateItem(item.id, { status });
      setItem({ ...updated, markdown: updated.markdown ?? item.markdown });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleFavorite() {
    if (!item) return;
    try {
      const updated = await api.updateItem(item.id, { is_favorite: !item.is_favorite });
      setItem({ ...updated, markdown: updated.markdown ?? item.markdown });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function openInApp() {
    if (!item) return;
    const { default: open } = await import("open");
    await open(`https://web.getmatter.com/entry/${item.id}`);
  }

  async function openInBrowser() {
    if (!item) return;
    const { default: open } = await import("open");
    await open(item.url);
  }

  useKeyboard((event) => {
    if (event.name === "left") {
      setActionIndex((i) => Math.max(0, i - 1));
    } else if (event.name === "right") {
      setActionIndex((i) => Math.min(actions.length - 1, i + 1));
    } else if (event.name === "return") {
      actions[actionIndex].action();
    } else {
      const action = actions.find((a) => a.key === event.name);
      if (action) action.action();
    }
  });

  if (loading) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg={theme.fg.muted}>Loading item...</text>
      </box>
    );
  }

  if (error != null || item == null) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg={theme.error}>{`Error: ${error ?? "Item not found"}`}</text>
      </box>
    );
  }

  const progress = Math.round(item.reading_progress * 100);
  const sidebarWidth = Math.min(30, Math.floor(width * 0.25));
  const notebookHeight = notebookOpen ? Math.max(8, Math.floor(height * 0.35)) : 0;

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Action bar */}
      <box flexDirection="row" height={1} backgroundColor={theme.bg.bar}>
        {actions.map((a, i) => (
          <text
            key={a.key}
            fg={i === actionIndex ? "#fff" : theme.fg.muted}
            bg={i === actionIndex ? theme.accent : undefined}
          >
            {` [${a.key}] ${a.label} `}
          </text>
        ))}
        <box flexGrow={1} />
        <text fg={item.is_favorite ? theme.warning : theme.fg.ghost}>
          {item.is_favorite ? " * " : "   "}
        </text>
      </box>

      {/* Main content: sidebar + reader */}
      <box flexDirection="row" flexGrow={1}>
        {/* Sidebar */}
        <box
          flexDirection="column"
          width={sidebarWidth}
          flexShrink={0}
          padding={1}
          borderStyle="single"
          borderColor={theme.border}
        >
          <text fg={theme.accent}><b>{item.title}</b></text>
          <box height={1} />
          {item.author != null ? <text fg={theme.fg.tertiary}>{item.author.name}</text> : null}
          {item.site_name != null && item.site_name !== "" ? <text fg={theme.fg.dim}>{item.site_name}</text> : null}
          <box height={1} />
          <text fg={theme.fg.faint}>Status</text>
          <text fg={statusColor(item.status)}>{item.status}</text>
          <box height={1} />
          <text fg={theme.fg.faint}>Type</text>
          <text fg={theme.fg.secondary}>{item.content_type}</text>
          <box height={1} />
          <text fg={theme.fg.faint}>Progress</text>
          <text fg={theme.success}>{`${progress}%`}</text>
          {item.word_count != null && item.word_count > 0 ? (
            <>
              <box height={1} />
              <text fg={theme.fg.faint}>Words</text>
              <text fg={theme.fg.secondary}>{item.word_count.toLocaleString()}</text>
            </>
          ) : null}
          {item.tags.length > 0 ? (
            <>
              <box height={1} />
              <text fg={theme.fg.faint}>Tags</text>
              {item.tags.map((t) => (
                <text key={t.id} fg={theme.accent}>{t.name}</text>
              ))}
            </>
          ) : null}
        </box>

        {/* Reader */}
        <box flexDirection="column" flexGrow={1} flexShrink={1}>
          {item.markdown ? (
            <scrollbox flexGrow={1} focused={!notebookOpen}>
              <box padding={1} flexDirection="column">
                <markdown
                  content={prepMarkdown(item.markdown)}
                  syntaxStyle={syntaxStyle}
                  conceal
                  fg={theme.fg.content}
                />
              </box>
            </scrollbox>
          ) : item.processing_status === "processing" ? (
            <box padding={1} flexDirection="column">
              <text fg={theme.fg.muted}>Content is still being processed...</text>
              <text fg={theme.fg.faint}>Check back in a moment.</text>
            </box>
          ) : item.excerpt != null && item.excerpt !== "" ? (
            <scrollbox flexGrow={1} focused={!notebookOpen}>
              <box padding={1} flexDirection="column">
                <text fg={theme.fg.secondary}>{item.excerpt}</text>
                <box height={1} />
                <text fg={theme.fg.faint}>Full content not available. Press [o] to open in browser.</text>
              </box>
            </scrollbox>
          ) : (
            <box padding={1} flexDirection="column">
              <text fg={theme.fg.faint}>No content available. Press [o] to open in browser.</text>
            </box>
          )}
        </box>
      </box>

      {/* Notebook panel (bottom) */}
      {notebookOpen ? (
        <box
          flexDirection="column"
          height={notebookHeight}
          borderStyle="single"
          borderColor={theme.border}
        >
          <NotebookPanel annotations={annotations} />
        </box>
      ) : null}
    </box>
  );
}
