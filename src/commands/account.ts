import { Command } from "commander";
import { MatterAPI } from "../api.js";
import { requireToken } from "../config.js";

export const accountCommand = new Command("account")
  .description("Show current user info")
  .option("--plain", "Human-readable output")
  .action(async (opts) => {
    const api = new MatterAPI(requireToken());
    try {
      const account = await api.getAccount();
      if (opts.plain) {
        console.log(`Name:    ${account.name}`);
        console.log(`Email:   ${account.email}`);
        console.log(`ID:      ${account.id}`);
        console.log(`Created: ${account.created_at}`);
        const rl = account.rate_limit;
        console.log(`Limits:  read=${rl.read}/min  write=${rl.write}/min  save=${rl.save}/min  burst=${rl.burst}/sec`);
      } else {
        console.log(JSON.stringify(account, null, 2));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
