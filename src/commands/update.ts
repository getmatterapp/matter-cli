import { Command } from "commander";
import { VERSION } from "../version.js";
import { checkForUpdate, performUpdate } from "../update.js";

export const updateCommand = new Command("update")
  .description("Update matter CLI to the latest version")
  .action(async () => {
    try {
      const latest = await checkForUpdate();
      if (!latest) {
        console.log(`Already on the latest version (${VERSION}).`);
        return;
      }

      console.log(`Updating from ${VERSION} to ${latest.version}...`);
      await performUpdate(latest);
      console.log(`Updated to ${latest.version}.`);
      if (latest.notes) {
        console.log(`\nWhat's new:\n${latest.notes}`);
      }
    } catch (err) {
      console.error(`Update failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });
