import { useState, useEffect, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { MatterAPI, Item } from "../api.js";
import { theme, statusColor } from "./theme.js";

interface ItemListProps {
  api: MatterAPI;
  status?: string;
  onSelect: (id: string) => void;
  onItemUpdated?: () => void;
}

export function ItemList({ api, status, onSelect, onItemUpdated }: ItemListProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const fetchItems = useCallback(
    async (nextCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.listItems({
          status: status as any,
          order: status === "inbox" ? "inbox_position" : status ? "library_position" : undefined,
          limit: 20,
          cursor: nextCursor,
        });
        if (nextCursor) {
          setItems((prev) => [...prev, ...result.results]);
        } else {
          setItems(result.results);
        }
        setHasMore(result.has_more);
        setCursor(result.next_cursor ?? undefined);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [api, status],
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function updateItem(index: number, data: { status?: "queue" | "archive"; is_favorite?: boolean }) {
    const item = items[index];
    if (!item) return;
    try {
      const updated = await api.updateItem(item.id, data);
      setItems((prev) => prev.map((it, i) => (i === index ? updated : it)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useKeyboard((event) => {
    const down = () => {
      setSelectedIndex((i) => {
        const next = Math.min(items.length - 1, i + 1);
        if (next >= items.length - 3 && hasMore && !loading) {
          fetchItems(cursor);
        }
        return next;
      });
    };
    const up = () => setSelectedIndex((i) => Math.max(0, i - 1));

    switch (event.name) {
      case "up":
      case "k":
        up();
        break;
      case "down":
      case "j":
        down();
        break;
      case "return":
        if (items[selectedIndex]) onSelect(items[selectedIndex].id);
        break;
      case "e":
        updateItem(selectedIndex, { status: "archive" });
        break;
      case "s": {
        const item = items[selectedIndex];
        if (item && item.status !== "queue") updateItem(selectedIndex, { status: "queue" });
        break;
      }
      case "f":
        if (items[selectedIndex]) updateItem(selectedIndex, { is_favorite: !items[selectedIndex].is_favorite });
        break;
    }
  });

  const title = status ? `Items — ${status}` : "All Items";

  if (error) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg={theme.error}>Error: {error}</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" padding={1}>
      <text fg={theme.accent}>
        <b>{title}</b>
      </text>
      <box height={1} />
      {items.map((item, i) => {
        const isSelected = i === selectedIndex;
        const progress = Math.round(item.reading_progress * 100);
        const site = item.site_name || "";
        const fav = item.is_favorite ? " *" : "";

        return (
          <box key={item.id} flexDirection="row">
            <text fg={isSelected ? theme.accent : theme.fg.ghost}>
              {isSelected ? " > " : "   "}
            </text>
            <text fg={isSelected ? theme.fg.primary : theme.fg.secondary} bg={isSelected ? theme.bg.selected : undefined}>
              {item.title.slice(0, 40).padEnd(42)}
            </text>
            <text fg={theme.fg.dim}>
              {site.slice(0, 18).padEnd(20)}
            </text>
            <text fg={statusColor(item.status)}>
              {item.status.padEnd(9)}
            </text>
            <text fg={theme.fg.muted}>{String(progress).padStart(3)}%{fav}</text>
          </box>
        );
      })}
      {loading && <text fg={theme.fg.muted}>Loading...</text>}
      {!loading && items.length === 0 && <text fg={theme.fg.dim}>No items found</text>}
      {hasMore && !loading && (
        <box height={1}>
          <text fg={theme.fg.faint}>Scroll down for more...</text>
        </box>
      )}
    </box>
  );
}
