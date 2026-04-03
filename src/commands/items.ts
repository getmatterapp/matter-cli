import { Command } from "commander";
import { MatterAPI, type Item } from "../api.js";
import { requireToken, requireWritable } from "../config.js";

function formatItemRow(item: Item): string {
  const progress = Math.round(item.reading_progress * 100);
  const site = item.site_name || (() => { try { return new URL(item.url).hostname; } catch { return ""; } })();
  const fav = item.is_favorite ? " ★" : "";
  const status = item.status ?? "—";
  return `${item.id.padEnd(12)}  ${item.title.slice(0, 40).padEnd(40)}  ${site.slice(0, 20).padEnd(20)}  ${status.padEnd(8)}  ${String(progress).padStart(3)}%${fav}`;
}

export const itemsCommand = new Command("items").description("Manage items");

itemsCommand
  .command("list")
  .description("List items")
  .option("--status <status>", "Filter by status: inbox, queue (reading list), archive (finished reading), all")
  .option("--tag <tag_id>", "Filter by tag ID")
  .option("--content-type <type>", "Filter by content type: article, podcast, video, pdf, tweet, newsletter")
  .option("--favorite", "Only favorites")
  .option("--order <order>", "Sort order: updated (last modified — any field change, default), library_position (app queue/archive order, manual drag-and-drop), inbox_position (inbox feed order, pinned sources first then by date)")
  .option("--updated-since <date>", "Filter by updated date (ISO 8601)")
  .option("--limit <n>", "Max results per page")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--all", "Fetch all pages")
  .option("--plain", "Human-readable output")
  .addHelpText("after", `
Note: --order updated is for sync, NOT for user-facing queries. It tracks any modification.
  For reading list / queue:   --status queue --order library_position
  For inbox feed:             --status inbox --order inbox_position
  For finished articles:      --status archive --order library_position
Run 'matter docs' for full reference and intent-to-command mappings.`)
  .action(async (opts) => {
    const api = new MatterAPI(requireToken());
    try {
      if (opts.all) {
        const items = await api.listAll<Item>((cursor) =>
          api.listItems({
            status: opts.status,
            tag: opts.tag,
            content_type: opts.contentType,
            is_favorite: opts.favorite ? true : undefined,
            order: opts.order,
            updated_since: opts.updatedSince,
            limit: opts.limit ? parseInt(opts.limit) : undefined,
            cursor,
          }),
        );
        if (opts.plain) {
          for (const item of items) console.log(formatItemRow(item));
          console.log(`\n${items.length} items total`);
        } else {
          console.log(JSON.stringify({ object: "list", results: items, has_more: false }, null, 2));
        }
        return;
      }

      const result = await api.listItems({
        status: opts.status,
        tag: opts.tag,
        content_type: opts.contentType,
        is_favorite: opts.favorite ? true : undefined,
        order: opts.order,
        updated_since: opts.updatedSince,
        limit: opts.limit ? parseInt(opts.limit) : undefined,
        cursor: opts.cursor,
      });

      if (opts.plain) {
        for (const item of result.results) console.log(formatItemRow(item));
        if (result.has_more) {
          console.log(`\nUse --cursor ${result.next_cursor} for next page`);
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

itemsCommand
  .command("get <id>")
  .description("Get a single item")
  .option("--plain", "Human-readable output")
  .action(async (id, opts) => {
    const api = new MatterAPI(requireToken());
    try {
      const item = await api.getItem(id);
      if (opts.plain) {
        console.log(`Title:    ${item.title}`);
        console.log(`URL:      ${item.url}`);
        console.log(`Status:   ${item.status}`);
        console.log(`Type:     ${item.content_type}`);
        console.log(`Progress: ${Math.round(item.reading_progress * 100)}%`);
        console.log(`Favorite: ${item.is_favorite ? "yes" : "no"}`);
        if (item.author) console.log(`Author:   ${item.author.name}`);
        if (item.tags.length) console.log(`Tags:     ${item.tags.map((t) => t.name).join(", ")}`);
        console.log(`Saved:    ${item.saved_at}`);
        console.log(`Updated:  ${item.updated_at}`);
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

itemsCommand
  .command("save")
  .description("Save a new item")
  .requiredOption("--url <url>", "URL to save")
  .option("--status <status>", "Initial status (queue|archive, default: queue)")
  .option("--plain", "Human-readable output")
  .action(async (opts) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      const item = await api.saveItem({
        url: opts.url,
        status: opts.status,
      });
      if (opts.plain) {
        console.log(`Saved: ${item.id}  ${item.title}`);
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

itemsCommand
  .command("update <id>")
  .description("Update an item")
  .option("--status <status>", "New status")
  .option("--favorite <bool>", "Set favorite (true|false)")
  .option("--progress <n>", "Reading progress (0.0-1.0)")
  .option("--plain", "Human-readable output")
  .action(async (id, opts) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      const data: Record<string, unknown> = {};
      if (opts.status) data.status = opts.status;
      if (opts.favorite !== undefined) data.is_favorite = opts.favorite === "true";
      if (opts.progress !== undefined) data.reading_progress = parseFloat(opts.progress);

      const item = await api.updateItem(id, data);
      if (opts.plain) {
        console.log(`Updated: ${item.id}  ${item.title}  [${item.status}]`);
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

itemsCommand
  .command("delete <id>")
  .description("Delete an item")
  .action(async (id) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      await api.deleteItem(id);
      console.log(JSON.stringify({ ok: true, message: `Deleted item ${id}` }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
