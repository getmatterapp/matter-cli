import { Command } from "commander";
import { saveToken, promptForToken } from "../auth.js";

export const loginCommand = new Command("login")
  .description("Log in to Matter (opens browser to get API token)")
  .action(async () => {
    const { default: open } = await import("open");
    console.error("Opening Matter settings in your browser...");
    console.error("Copy your API token from the settings page.");
    await open("https://web.getmatter.com/settings");

    try {
      const token = await promptForToken();
      await saveToken(token);
      console.log(JSON.stringify({ ok: true, message: "Logged in successfully." }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

export const loginWithTokenCommand = new Command("login-with-token")
  .description("Log in with a Matter API token directly")
  .action(async () => {
    try {
      const token = await promptForToken();
      await saveToken(token);
      console.log(JSON.stringify({ ok: true, message: "Logged in successfully." }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
