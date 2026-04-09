import { Command } from "commander";
import { MatterAPI } from "../api.js";
import { requireToken } from "../config.js";

export const readingSessionsCommand = new Command("reading-sessions")
  .description("List reading sessions");

readingSessionsCommand
  .command("list")
  .description("List reading sessions")
  .option("--since <datetime>", "Only sessions on or after this ISO 8601 datetime")
  .option("--limit <n>", "Results per page (1-100)", "25")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--all", "Fetch all pages")
  .option("--plain", "Human-readable output")
  .action(async (opts) => {
    const api = new MatterAPI(requireToken());
    try {
      if (opts.all) {
        const sessions = await api.listAll((cursor) =>
          api.listReadingSessions({
            since: opts.since,
            limit: 100,
            cursor,
          }),
        );
        if (opts.plain) {
          for (const s of sessions) {
            console.log(`${s.date}  ${formatDuration(s.seconds_read)}`);
          }
        } else {
          console.log(JSON.stringify(sessions, null, 2));
        }
      } else {
        const result = await api.listReadingSessions({
          since: opts.since,
          limit: Number(opts.limit),
          cursor: opts.cursor,
        });
        if (opts.plain) {
          for (const s of result.results) {
            console.log(`${s.date}  ${formatDuration(s.seconds_read)}`);
          }
          if (result.has_more) {
            console.log(`\nMore results available. Use --cursor ${result.next_cursor}`);
          }
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
