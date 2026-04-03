#!/usr/bin/env bun
import { Command } from "commander";
import { VERSION } from "./version.js";
import { loadConfig } from "./config.js";
import { backgroundUpdateCheck } from "./update.js";
import { loginCommand, loginWithTokenCommand } from "./commands/login.js";
import { accountCommand } from "./commands/account.js";
import { itemsCommand } from "./commands/items.js";
import { annotationsCommand } from "./commands/annotations.js";
import { tagsCommand } from "./commands/tags.js";
import { updateCommand } from "./commands/update.js";
import { searchCommand } from "./commands/search.js";
import { docsCommand } from "./commands/docs.js";

const program = new Command()
  .name("matter")
  .description("CLI for the Matter reading app")
  .version(VERSION, "-v, --version")
  .addHelpText("after", "\nFor AI agents: run 'matter docs' for full reference docs and intent-to-command mappings.");

program.addCommand(loginCommand);
program.addCommand(loginWithTokenCommand);
program.addCommand(accountCommand);
program.addCommand(itemsCommand);
program.addCommand(annotationsCommand);
program.addCommand(tagsCommand);
program.addCommand(searchCommand);
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
