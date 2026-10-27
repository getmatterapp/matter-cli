import { Command } from "commander";
import { MatterAPI } from "../api.js";
import { isReadonly, requireToken } from "../config.js";
import { runMcpServer } from "../mcp.js";

export const mcpCommand = new Command("mcp")
  .description("Run a Model Context Protocol server over stdio")
  .addHelpText("after", `
Add to an MCP client config:
  { "mcpServers": { "matter": { "command": "matter", "args": ["mcp"] } } }

Write tools are hidden when readonly mode is enabled.`)
  .action(async () => {
    const api = new MatterAPI(requireToken());
    await runMcpServer({ api, isReadonly });
  });
