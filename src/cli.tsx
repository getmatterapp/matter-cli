#!/usr/bin/env bun
import { Command } from "commander";
import { VERSION } from "./version.js";
import { loadConfig } from "./config.js";
import { backgroundUpdateCheck } from "./update.js";
import { loginCommand } from "./commands/login.js";
import { accountCommand } from "./commands/account.js";
import { itemsCommand } from "./commands/items.js";
import { annotationsCommand } from "./commands/annotations.js";
import { tagsCommand } from "./commands/tags.js";
import { updateCommand } from "./commands/update.js";
import { searchCommand } from "./commands/search.js";
import { docsCommand } from "./commands/docs.js";
import { tuiCommand } from "./commands/tui.js";

const program = new Command()
  .name("matter")
  .description("CLI for the Matter reading app")
  .version(VERSION, "-v, --version")
  .addHelpText("after", `
Common workflows:
  Browse your reading list      matter items list --status queue
  Check your inbox              matter items list --status inbox
  Read or summarize an article  matter items get <id> --include markdown
  Find an article by topic      matter search "<topic>"
  View highlights               matter annotations list --item <id> --all
  List all tags                 matter tags list
  Launch interactive TUI        matter tui

Run 'matter docs' for full API reference.`);

program.addCommand(loginCommand);
program.addCommand(accountCommand);
program.addCommand(itemsCommand);
program.addCommand(annotationsCommand);
program.addCommand(tagsCommand);
program.addCommand(searchCommand);
program.addCommand(tuiCommand);
program.addCommand(docsCommand);
program.addCommand(updateCommand);

const args = process.argv.slice(2);
const hasSubcommand = args.length > 0 && !args[0].startsWith("-");
const hasFlags = args.some((a) => a.startsWith("-"));

if (!hasSubcommand && !hasFlags && process.stdout.isTTY) {
  const config = loadConfig();
  if (config.access_token) {
    // Launch TUI
    const { launchTUI } = await import("./tui/App.js");
    await launchTUI();
  } else {
    program.outputHelp();
  }
} else {
  // Kick off background update check (non-blocking)
  backgroundUpdateCheck();
  await program.parseAsync(process.argv);
}
