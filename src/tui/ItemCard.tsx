import { useState, useEffect, useRef, useCallback } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { SyntaxStyle } from "@opentui/core";
import type { MatterAPI, Item, Annotation } from "../api.js";
import { theme } from "./theme.js";

interface ItemCardProps {
  api: MatterAPI;
  itemId: string;
  onNavigate: (view: unknown) => void;
}

const syntaxStyle = SyntaxStyle.create();

// Matter's API returns markdown with backslash-escaped punctuation
// (e.g. \-, \(, \), \., \!) which is valid markdown but renders
// poorly in some parsers. Strip these escapes before display.
function prepMarkdown(md: string): string {
  return md
    .replace(/\\([^\\\n])/g, "$1")  // unescape backslash-escaped chars
    .replace(/\u200b/g, "");         // strip zero-width spaces
}

export function ItemCard({ api, itemId }: ItemCardProps) {
  const { width } = useTerminalDimensions();
  const [item, setItem] = useState<Item | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const progressRef = useRef(0);

  const actions = [
    { key: "q", label: "Queue", action: () => updateStatus("queue") },
    { key: "a", label: "Archive", action: () => updateStatus("archive") },
    { key: "f", label: "Fav", action: () => toggleFavorite() },
    ...(item?.markdown ? [{ key: "o", label: "Open", action: () => openInApp() }] : []),
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
      setItem(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleFavorite() {
    if (!item) return;
    try {
      const updated = await api.updateItem(item.id, { is_favorite: !item.is_favorite });
      setItem(updated);
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

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Action bar */}
      <box flexDirection="row" height={1} backgroundColor={theme.bg.bar}>
        {actions.map((a, i) => (
          <text
            key={a.key}
            fg={i === actionIndex ? theme.fg.primary : theme.fg.muted}
            bg={i === actionIndex ? theme.accent : undefined}
          >
            {` [${a.key}] ${a.label} `}
          </text>
        ))}
        <box flexGrow={1} />
        <text fg={item.is_favorite ? theme.warning : theme.fg.ghost}>
          {item.is_favorite ? " * " : "   "}
        </text>
        <text fg={theme.fg.muted}>{`${item.status} `}</text>
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
          {annotations.length > 0 ? (
            <>
              <box height={1} />
              <text fg={theme.fg.faint}>{`Highlights (${annotations.length})`}</text>
              {annotations.slice(0, 5).map((ann) => (
                <box key={ann.id} flexDirection="column">
                  <text fg={theme.warning}>{`"${ann.text.slice(0, 40)}"`}</text>
                  {ann.note != null && ann.note !== "" ? <text fg={theme.fg.dim}>{`  ${ann.note.slice(0, 30)}`}</text> : null}
                </box>
              ))}
              {annotations.length > 5 ? (
                <text fg={theme.fg.faint}>{`+${annotations.length - 5} more`}</text>
              ) : null}
            </>
          ) : null}
        </box>

        {/* Reader */}
        <box flexDirection="column" flexGrow={1} flexShrink={1}>
          {item.markdown ? (
            <scrollbox flexGrow={1} focused>
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
            <scrollbox flexGrow={1} focused>
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
    </box>
  );
}
