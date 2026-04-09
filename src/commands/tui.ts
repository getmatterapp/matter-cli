import { Command } from "commander";
import { requireToken } from "../config.js";

export const tuiCommand = new Command("tui")
  .description("Launch the interactive terminal UI")
  .action(async () => {
    requireToken();
    const { launchTUI } = await import("../tui/App.js");
    await launchTUI();
  });
