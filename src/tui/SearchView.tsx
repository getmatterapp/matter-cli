import { useState, useCallback, useRef, useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import type { MatterAPI, Item } from "../api.js";
import { theme, statusColor } from "./theme.js";

interface SearchViewProps {
  api: MatterAPI;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const STATUS_OPTIONS = [undefined, "queue", "archive"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

type Focus = "input" | "results";

export function SearchView({ api, onSelect, onBack }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [focus, setFocus] = useState<Focus>("input");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (q: string, status: StatusFilter, nextCursor?: string) => {
      if (q.length < 2) {
        if (!nextCursor) {
          setItems([]);
          setHasMore(false);
          setSearched(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const data = await api.search({
          query: q,
          type: "items",
          status,
          limit: 20,
          cursor: nextCursor,
        });
        const itemResults = data.items;
        if (nextCursor) {
          setItems((prev) => [...prev, ...(itemResults?.results ?? [])]);
        } else {
          setItems(itemResults?.results ?? []);
          setSelectedIndex(0);
        }
        setHasMore(itemResults?.has_more ?? false);
        setCursor(itemResults?.next_cursor ?? undefined);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  // Debounced search on query or filter change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, statusFilter);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, statusFilter, doSearch]);

  const moveSelection = useCallback(
    (dir: 1 | -1) => {
      setSelectedIndex((i) => {
        const next = dir === 1 ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
        if (dir === 1 && next >= items.length - 3 && hasMore && !loading) {
          doSearch(query, statusFilter, cursor);
        }
        return next;
      });
    },
    [items.length, hasMore, loading, doSearch, query, statusFilter, cursor],
  );

  useKeyboard((event) => {
    if (event.name === "tab") {
      setStatusFilter((f) => {
        const i = STATUS_OPTIONS.indexOf(f);
        return STATUS_OPTIONS[(i + 1) % STATUS_OPTIONS.length];
      });
      return;
    }

    if (focus === "results") {
      switch (event.name) {
        case "up":
          if (selectedIndex === 0) {
            setFocus("input");
            return;
          }
          moveSelection(-1);
          return;
        case "k":
          moveSelection(-1);
          return;
        case "down":
        case "j":
          moveSelection(1);
          return;
        case "return":
          if (items[selectedIndex]) onSelect(items[selectedIndex].id);
          return;
        case "escape":
          setFocus("input");
          return;
      }
      if (event.raw && event.raw.length === 1 && event.raw >= " ") {
        setFocus("input");
        setQuery((q) => q + event.raw);
      }
      return;
    }

    // Input mode.
    switch (event.name) {
      case "return":
        if (items.length > 0) setFocus("results");
        return;
      case "escape":
        onBack();
        return;
      case "backspace":
        setQuery((q) => q.slice(0, -1));
        return;
      case "up":
        return;
      case "down":
        if (items.length > 0) setFocus("results");
        return;
    }
    if (event.raw && event.raw.length === 1 && event.raw >= " ") {
      setQuery((q) => q + event.raw);
    }
  });

  return (
    <box flexDirection="column" padding={1}>
      <text fg={theme.accent}>
        <b>Search</b>
      </text>
      <box height={1} />
      <box flexDirection="row">
        <text fg={focus === "input" ? theme.accent : theme.fg.ghost}>/ </text>
        <text fg={focus === "input" ? theme.fg.primary : theme.fg.dim}>{query || " "}</text>
        {focus === "input" && <text fg={theme.accent}>_</text>}
      </box>
      <box flexDirection="row">
        <text fg={theme.fg.faint}>tab </text>
        {STATUS_OPTIONS.map((opt) => {
          const label = opt ?? "library";
          const active = opt === statusFilter;
          return (
            <text key={label} fg={active ? theme.accent : theme.fg.ghost}>
              {active ? `[${label}]` : ` ${label} `}
              {" "}
            </text>
          );
        })}
      </box>
      <box height={1} />

      {!searched && !query && (
        <text fg={theme.fg.faint}>
          "exact phrase"  -exclude  by:author  site:domain  title:word
        </text>
      )}
      {error && <text fg={theme.error}>Error: {error}</text>}

      {items.map((item, i) => {
        const isSelected = i === selectedIndex;
        const active = isSelected && focus === "results";
        const progress = Math.round(item.reading_progress * 100);
        const site = item.site_name || "";
        const fav = item.is_favorite ? " *" : "";

        return (
          <box key={item.id} flexDirection="row">
            <text fg={active ? theme.accent : theme.fg.ghost}>
              {active ? " > " : "   "}
            </text>
            <text fg={active ? theme.fg.primary : theme.fg.secondary} bg={active ? theme.bg.selected : undefined}>
              {item.title.slice(0, 40).padEnd(42)}
            </text>
            <text fg={theme.fg.dim}>
              {site.slice(0, 18).padEnd(20)}
            </text>
            <text fg={statusColor(item.status ?? "")}>
              {(item.status ?? "—").padEnd(9)}
            </text>
            <text fg={theme.fg.muted}>{String(progress).padStart(3)}%{fav}</text>
          </box>
        );
      })}

      {loading && <text fg={theme.fg.muted}>Searching...</text>}
      {!loading && searched && items.length === 0 && (
        <text fg={theme.fg.dim}>No results found</text>
      )}
      {!loading && !searched && query.length > 0 && query.length < 2 && (
        <text fg={theme.fg.dim}>Type at least 2 characters to search</text>
      )}
      {hasMore && !loading && (
        <box height={1}>
          <text fg={theme.fg.faint}>Scroll down for more...</text>
        </box>
      )}
    </box>
  );
}
