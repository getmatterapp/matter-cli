import { Command } from "commander";
import { MatterAPI } from "../api.js";
import { requireToken, requireWritable } from "../config.js";

export const tagsCommand = new Command("tags").description("Manage tags");

tagsCommand
  .command("list")
  .description("List all tags")
  .option("--plain", "Human-readable output")
  .action(async (opts) => {
    const api = new MatterAPI(requireToken());
    try {
      const result = await api.listTags();
      if (opts.plain) {
        for (const tag of result.results) {
          console.log(`${tag.id}  ${tag.name}`);
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

tagsCommand
  .command("rename <id>")
  .description("Rename a tag")
  .requiredOption("--name <name>", "New tag name")
  .option("--plain", "Human-readable output")
  .action(async (id, opts) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      const tag = await api.renameTag(id, opts.name);
      if (opts.plain) {
        console.log(`Renamed: ${tag.id}  ${tag.name}`);
      } else {
        console.log(JSON.stringify(tag, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

tagsCommand
  .command("delete <id>")
  .description("Delete a tag")
  .action(async (id) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      await api.deleteTag(id);
      console.log(JSON.stringify({ ok: true, message: `Deleted tag ${id}` }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

tagsCommand
  .command("add")
  .description("Add a tag to an item (creates tag if new)")
  .requiredOption("--item <item_id>", "Item ID")
  .requiredOption("--name <name>", "Tag name (reuses existing tag if name matches)")
  .option("--plain", "Human-readable output")
  .action(async (opts) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      const tag = await api.addTagToItem(opts.item, opts.name);
      if (opts.plain) {
        console.log(`Added tag: ${tag.id}  ${tag.name}  -> item ${opts.item}`);
      } else {
        console.log(JSON.stringify(tag, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

tagsCommand
  .command("remove")
  .description("Remove a tag from an item")
  .requiredOption("--item <item_id>", "Item ID")
  .requiredOption("--tag <tag_id>", "Tag ID")
  .action(async (opts) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      await api.removeTagFromItem(opts.item, opts.tag);
      console.log(JSON.stringify({ ok: true, message: `Removed tag ${opts.tag} from item ${opts.item}` }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
