import { useState, useEffect, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { MatterAPI, Item } from "../api.js";
import { theme, statusColor } from "./theme.js";

interface ItemListProps {
  api: MatterAPI;
  status?: string;
  onSelect: (id: string) => void;
}

export function ItemList({ api, status, onSelect }: ItemListProps) {
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

  useKeyboard((event) => {
    if (event.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (event.name === "down") {
      setSelectedIndex((i) => {
        const next = Math.min(items.length - 1, i + 1);
        // Load more when near the end
        if (next >= items.length - 3 && hasMore && !loading) {
          fetchItems(cursor);
        }
        return next;
      });
    } else if (event.name === "return") {
      if (items[selectedIndex]) {
        onSelect(items[selectedIndex].id);
      }
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
