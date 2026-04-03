import { Command } from "commander";
import { MatterAPI, type Item, type SearchResults } from "../api.js";
import { requireToken } from "../config.js";

function formatItemRow(item: Item): string {
  const progress = Math.round(item.reading_progress * 100);
  const site = item.site_name || (() => { try { return new URL(item.url).hostname; } catch { return ""; } })();
  const fav = item.is_favorite ? " ★" : "";
  const status = item.status ?? "—";
  return `${item.id.padEnd(12)}  ${item.title.slice(0, 40).padEnd(40)}  ${site.slice(0, 20).padEnd(20)}  ${status.padEnd(8)}  ${String(progress).padStart(3)}%${fav}`;
}

export const searchCommand = new Command("search")
  .description("Search Matter")
  .argument("<query>", "Search query")
  .requiredOption("--type <type>", "Result types, comma-separated (e.g. items)")
  .option("--status <status>", "Filter items by status: queue, archive (omit for all)")
  .option("--limit <n>", "Max results per page")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--all", "Fetch all pages")
  .option("--plain", "Human-readable output")
  .action(async (query, opts) => {
    const api = new MatterAPI(requireToken());
    try {
      if (opts.all) {
        const allItems: Item[] = [];
        let cursor: string | undefined;
        do {
          const data = await api.search({
            query,
            type: opts.type,
            status: opts.status,
            limit: opts.limit ? parseInt(opts.limit) : undefined,
            cursor,
          });
          const items = data.items;
          if (items) {
            allItems.push(...items.results);
            cursor = items.has_more ? (items.next_cursor ?? undefined) : undefined;
          } else {
            cursor = undefined;
          }
        } while (cursor);

        if (opts.plain) {
          for (const item of allItems) console.log(formatItemRow(item));
          console.log(`\n${allItems.length} results`);
        } else {
          const out: SearchResults = {
            object: "search_results",
            items: { object: "list", results: allItems, has_more: false, next_cursor: null },
          };
          console.log(JSON.stringify(out, null, 2));
        }
        return;
      }

      const data = await api.search({
        query,
        type: opts.type,
        status: opts.status,
        limit: opts.limit ? parseInt(opts.limit) : undefined,
        cursor: opts.cursor,
      });

      if (opts.plain) {
        const items = data.items?.results ?? [];
        for (const item of items) console.log(formatItemRow(item));
        if (data.items?.has_more) {
          console.log(`\nUse --cursor ${data.items.next_cursor} for next page`);
        }
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
