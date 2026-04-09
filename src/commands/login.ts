import { Command } from "commander";
import { saveToken, promptForToken } from "../auth.js";

export const loginCommand = new Command("login")
  .description("Log in to Matter")
  .argument("[token]", "API token (skips browser if provided)")
  .action(async (token?: string) => {
    try {
      if (token) {
        await saveToken(token);
      } else {
        const { default: open } = await import("open");
        console.error("Opening Matter settings in your browser...");
        console.error("Copy your API token from the settings page.\n");
        await open("https://web.getmatter.com/settings");
        const prompted = await promptForToken();
        await saveToken(prompted);
      }
      console.log("Logged in successfully.");
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
