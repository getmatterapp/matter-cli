import { Command } from "commander";
import { VERSION } from "../version.js";
import { checkForUpdate, performUpdate } from "../update.js";

export const updateCommand = new Command("update")
  .description("Update matter CLI to the latest version")
  .action(async () => {
    try {
      const latest = await checkForUpdate();
      if (!latest) {
        console.log(JSON.stringify({ ok: true, message: `Already on latest version (${VERSION}).` }));
        return;
      }

      console.error(`Updating from ${VERSION} to ${latest.version}...`);
      await performUpdate(latest);
      console.log(JSON.stringify({ ok: true, message: `Updated to ${latest.version}.`, release_notes: latest.notes }));
    } catch (err) {
      console.error(`Update failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });
