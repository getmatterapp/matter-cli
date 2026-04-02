import { Command } from "commander";
import { MatterAPI, type Annotation } from "../api.js";
import { requireToken, requireWritable } from "../config.js";

function formatAnnotationRow(ann: Annotation): string {
  const text = ann.text.slice(0, 60).replace(/\n/g, " ");
  const note = ann.note ? ` [note: ${ann.note.slice(0, 30)}]` : "";
  return `${ann.id}  ${ann.item_id}  "${text}"${note}`;
}

export const annotationsCommand = new Command("annotations").description("Manage annotations");

annotationsCommand
  .command("list")
  .description("List annotations for an item")
  .requiredOption("--item <item_id>", "Item ID")
  .option("--limit <n>", "Max results per page")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--all", "Fetch all pages")
  .option("--plain", "Human-readable output")
  .action(async (opts) => {
    const api = new MatterAPI(requireToken());
    try {
      if (opts.all) {
        const annotations = await api.listAll<Annotation>((cursor) =>
          api.listAnnotations({
            item_id: opts.item,
            limit: opts.limit ? parseInt(opts.limit) : undefined,
            cursor,
          }),
        );
        if (opts.plain) {
          for (const ann of annotations) console.log(formatAnnotationRow(ann));
          console.log(`\n${annotations.length} annotations total`);
        } else {
          console.log(JSON.stringify({ object: "list", results: annotations, has_more: false }, null, 2));
        }
        return;
      }

      const result = await api.listAnnotations({
        item_id: opts.item,
        limit: opts.limit ? parseInt(opts.limit) : undefined,
        cursor: opts.cursor,
      });

      if (opts.plain) {
        for (const ann of result.results) console.log(formatAnnotationRow(ann));
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

annotationsCommand
  .command("get <id>")
  .description("Get a single annotation")
  .option("--plain", "Human-readable output")
  .action(async (id, opts) => {
    const api = new MatterAPI(requireToken());
    try {
      const ann = await api.getAnnotation(id);
      if (opts.plain) {
        console.log(`ID:      ${ann.id}`);
        console.log(`Item:    ${ann.item_id}`);
        console.log(`Text:    ${ann.text}`);
        if (ann.note) console.log(`Note:    ${ann.note}`);
        console.log(`Created: ${ann.created_at}`);
        console.log(`Updated: ${ann.updated_at}`);
      } else {
        console.log(JSON.stringify(ann, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

annotationsCommand
  .command("update <id>")
  .description("Update an annotation")
  .option("--note <note>", "Set note text")
  .option("--plain", "Human-readable output")
  .action(async (id, opts) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      const ann = await api.updateAnnotation(id, { note: opts.note });
      if (opts.plain) {
        console.log(`Updated: ${ann.id}  "${ann.text.slice(0, 40)}"`);
      } else {
        console.log(JSON.stringify(ann, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

annotationsCommand
  .command("delete <id>")
  .description("Delete an annotation")
  .action(async (id) => {
    requireWritable();
    const api = new MatterAPI(requireToken());
    try {
      await api.deleteAnnotation(id);
      console.log(JSON.stringify({ ok: true, message: `Deleted annotation ${id}` }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
