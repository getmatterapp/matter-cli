// Model Context Protocol server over stdio
// Spec: https://modelcontextprotocol.io/specification/2025-06-18
// Hand-rolled JSON-RPC to keep runtime dependencies to the set in CLAUDE.md.

import { createInterface } from "readline";
import { MatterAPI, MatterAPIError, type Item } from "./api.js";
import { VERSION } from "./version.js";

// --- JSON-RPC types ---

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

// --- Tools ---

type Args = Record<string, unknown>;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  write: boolean;
  destructive?: boolean;
  run: (api: MatterAPI, args: Args) => Promise<unknown>;
}

export interface ServerContext {
  api: MatterAPI;
  isReadonly: () => boolean;
}

class ToolInputError extends Error {}

function str(args: Args, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ToolInputError(`'${key}' must be a string`);
  return value;
}

function requiredStr(args: Args, key: string): string {
  const value = str(args, key);
  if (!value) throw new ToolInputError(`'${key}' is required`);
  return value;
}

function num(args: Args, key: string): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) throw new ToolInputError(`'${key}' must be a number`);
  return value;
}

function bool(args: Args, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new ToolInputError(`'${key}' must be a boolean`);
  return value;
}

const ID = (prefix: string, what: string) => ({ type: "string", description: `${what} ID (prefixed ${prefix})` });
const LIMIT = { type: "integer", minimum: 1, maximum: 100, description: "Max results per page" };
const CURSOR = { type: "string", description: "Pagination cursor from a previous next_cursor" };
const CONTENT_TYPES = ["article", "podcast", "video", "pdf", "tweet", "newsletter"];

export const TOOLS: ToolDef[] = [
  {
    name: "get_account",
    description: "Get the authenticated Matter account, including rate limits.",
    inputSchema: { type: "object", properties: {} },
    write: false,
    run: (api) => api.getAccount(),
  },
  {
    name: "list_items",
    description:
      "List saved items. For the reading list use status=queue, order=library_position. " +
      "For the inbox use status=inbox, order=inbox_position. For finished reading use status=archive, order=library_position. " +
      "order=updated tracks any field change and is meant for sync, not user-facing lists.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["inbox", "queue", "archive", "all"], description: "queue = reading list, archive = finished" },
        tag: ID("tag_", "Tag"),
        content_type: { type: "string", enum: CONTENT_TYPES },
        is_favorite: { type: "boolean", description: "Only favorites when true" },
        order: { type: "string", enum: ["library_position", "inbox_position", "updated"] },
        updated_since: { type: "string", description: "ISO 8601 datetime" },
        limit: LIMIT,
        cursor: CURSOR,
      },
    },
    write: false,
    run: (api, args) =>
      api.listItems({
        status: str(args, "status") as "inbox" | "queue" | "archive" | "all" | undefined,
        tag: str(args, "tag"),
        content_type: str(args, "content_type") as Item["content_type"] | undefined,
        is_favorite: bool(args, "is_favorite"),
        order: str(args, "order") as "updated" | "library_position" | "inbox_position" | undefined,
        updated_since: str(args, "updated_since"),
        limit: num(args, "limit"),
        cursor: str(args, "cursor"),
      }),
  },
  {
    name: "get_item",
    description: "Get one item. Set include_markdown to read or summarize the article text.",
    inputSchema: {
      type: "object",
      properties: { id: ID("itm_", "Item"), include_markdown: { type: "boolean" } },
      required: ["id"],
    },
    write: false,
    run: (api, args) => api.getItem(requiredStr(args, "id"), bool(args, "include_markdown") ? "markdown" : undefined),
  },
  {
    name: "search_items",
    description: "Full-text search over items. Supports 'by:<author>' and 'site:<domain>' in the query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: { type: "string", enum: ["queue", "archive"], description: "Omit to search both" },
        limit: LIMIT,
        cursor: CURSOR,
      },
      required: ["query"],
    },
    write: false,
    run: (api, args) =>
      api.search({
        query: requiredStr(args, "query"),
        type: "items",
        status: str(args, "status") as "queue" | "archive" | undefined,
        limit: num(args, "limit"),
        cursor: str(args, "cursor"),
      }),
  },
  {
    name: "save_item",
    description: "Save a URL to Matter.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, status: { type: "string", enum: ["queue", "archive"], description: "Default: queue" } },
      required: ["url"],
    },
    write: true,
    run: (api, args) =>
      api.saveItem({ url: requiredStr(args, "url"), status: str(args, "status") as "queue" | "archive" | undefined }),
  },
  {
    name: "update_item",
    description: "Change an item's status, favorite flag, or reading progress.",
    inputSchema: {
      type: "object",
      properties: {
        id: ID("itm_", "Item"),
        status: { type: "string", enum: ["queue", "archive"] },
        is_favorite: { type: "boolean" },
        reading_progress: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["id"],
    },
    write: true,
    run: (api, args) => {
      const data: Record<string, unknown> = {};
      const status = str(args, "status");
      const isFavorite = bool(args, "is_favorite");
      const progress = num(args, "reading_progress");
      if (status) data.status = status;
      if (isFavorite !== undefined) data.is_favorite = isFavorite;
      if (progress !== undefined) data.reading_progress = progress;
      return api.updateItem(requiredStr(args, "id"), data);
    },
  },
  {
    name: "delete_item",
    description: "Permanently delete an item. Confirm with the user first.",
    inputSchema: { type: "object", properties: { id: ID("itm_", "Item") }, required: ["id"] },
    write: true,
    destructive: true,
    run: async (api, args) => {
      const id = requiredStr(args, "id");
      await api.deleteItem(id);
      return { ok: true, message: `Deleted item ${id}` };
    },
  },
  {
    name: "list_annotations",
    description: "List highlights on an item. Set all=true to fetch every page.",
    inputSchema: {
      type: "object",
      properties: { item_id: ID("itm_", "Item"), all: { type: "boolean" }, limit: LIMIT, cursor: CURSOR },
      required: ["item_id"],
    },
    write: false,
    run: async (api, args) => {
      const itemId = requiredStr(args, "item_id");
      if (bool(args, "all")) {
        const results = await api.listAll((cursor) => api.listAnnotations({ item_id: itemId, limit: 100, cursor }));
        return { object: "list", results, has_more: false, next_cursor: null };
      }
      return api.listAnnotations({ item_id: itemId, limit: num(args, "limit"), cursor: str(args, "cursor") });
    },
  },
  {
    name: "get_annotation",
    description: "Get one highlight.",
    inputSchema: { type: "object", properties: { id: ID("ann_", "Annotation") }, required: ["id"] },
    write: false,
    run: (api, args) => api.getAnnotation(requiredStr(args, "id")),
  },
  {
    name: "update_annotation",
    description: "Set or clear the note on a highlight. Pass note=null to clear it.",
    inputSchema: {
      type: "object",
      properties: { id: ID("ann_", "Annotation"), note: { type: ["string", "null"] } },
      required: ["id", "note"],
    },
    write: true,
    run: (api, args) => {
      if (!("note" in args)) throw new ToolInputError("'note' is required");
      return api.updateAnnotation(requiredStr(args, "id"), { note: str(args, "note") ?? null });
    },
  },
  {
    name: "delete_annotation",
    description: "Permanently delete a highlight. Confirm with the user first.",
    inputSchema: { type: "object", properties: { id: ID("ann_", "Annotation") }, required: ["id"] },
    write: true,
    destructive: true,
    run: async (api, args) => {
      const id = requiredStr(args, "id");
      await api.deleteAnnotation(id);
      return { ok: true, message: `Deleted annotation ${id}` };
    },
  },
  {
    name: "list_tags",
    description: "List tags with item counts.",
    inputSchema: { type: "object", properties: { limit: LIMIT, cursor: CURSOR } },
    write: false,
    run: (api, args) => api.listTags({ limit: num(args, "limit"), cursor: str(args, "cursor") }),
  },
  {
    name: "rename_tag",
    description: "Rename a tag.",
    inputSchema: { type: "object", properties: { id: ID("tag_", "Tag"), name: { type: "string" } }, required: ["id", "name"] },
    write: true,
    run: (api, args) => api.renameTag(requiredStr(args, "id"), requiredStr(args, "name")),
  },
  {
    name: "delete_tag",
    description: "Permanently delete a tag from every item. Confirm with the user first.",
    inputSchema: { type: "object", properties: { id: ID("tag_", "Tag") }, required: ["id"] },
    write: true,
    destructive: true,
    run: async (api, args) => {
      const id = requiredStr(args, "id");
      await api.deleteTag(id);
      return { ok: true, message: `Deleted tag ${id}` };
    },
  },
  {
    name: "add_tag_to_item",
    description: "Tag an item by tag name. Creates the tag if it does not exist.",
    inputSchema: {
      type: "object",
      properties: { item_id: ID("itm_", "Item"), name: { type: "string", description: "Tag name" } },
      required: ["item_id", "name"],
    },
    write: true,
    run: (api, args) => api.addTagToItem(requiredStr(args, "item_id"), requiredStr(args, "name")),
  },
  {
    name: "remove_tag_from_item",
    description: "Remove a tag from an item. The tag itself is kept.",
    inputSchema: {
      type: "object",
      properties: { item_id: ID("itm_", "Item"), tag_id: ID("tag_", "Tag") },
      required: ["item_id", "tag_id"],
    },
    write: true,
    run: async (api, args) => {
      const itemId = requiredStr(args, "item_id");
      const tagId = requiredStr(args, "tag_id");
      await api.removeTagFromItem(itemId, tagId);
      return { ok: true, message: `Removed tag ${tagId} from item ${itemId}` };
    },
  },
  {
    name: "list_reading_sessions",
    description: "List daily reading sessions with seconds read.",
    inputSchema: {
      type: "object",
      properties: { since: { type: "string", description: "ISO 8601 datetime" }, limit: LIMIT, cursor: CURSOR },
    },
    write: false,
    run: (api, args) =>
      api.listReadingSessions({ since: str(args, "since"), limit: num(args, "limit"), cursor: str(args, "cursor") }),
  },
];

function describeTool(tool: ToolDef) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      readOnlyHint: !tool.write,
      destructiveHint: tool.write ? Boolean(tool.destructive) : undefined,
      openWorldHint: true,
    },
  };
}

function toolError(text: string) {
  return { content: [{ type: "text", text }], isError: true };
}

async function callTool(ctx: ServerContext, params: Args): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) return null;
  if (tool.write && ctx.isReadonly()) {
    return toolError("Readonly mode is enabled. Disable it in settings or re-authenticate to allow write operations.");
  }
  const args = (params.arguments ?? {}) as Args;
  try {
    const result = await tool.run(ctx.api, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    if (err instanceof MatterAPIError) {
      return toolError(`${err.code}: ${err.message}${err.field ? ` (field: ${err.field})` : ""}`);
    }
    return toolError((err as Error).message);
  }
}

// --- Request handling ---

function reply(id: JsonRpcResponse["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: JsonRpcResponse["id"], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// Returns null for notifications, which get no response.
export async function handleMessage(msg: unknown, ctx: ServerContext): Promise<JsonRpcResponse | null> {
  if (typeof msg !== "object" || msg === null || (msg as JsonRpcRequest).jsonrpc !== "2.0" || typeof (msg as JsonRpcRequest).method !== "string") {
    return fail(null, INVALID_REQUEST, "Invalid request");
  }
  const req = msg as JsonRpcRequest;
  const isNotification = req.id === undefined;
  const id = req.id ?? null;
  const params = req.params ?? {};

  let response: JsonRpcResponse;
  switch (req.method) {
    case "initialize": {
      const requested = params.protocolVersion as string | undefined;
      const protocolVersion =
        requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
      response = reply(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "matter", version: VERSION },
        instructions:
          "Matter is a read-later app. IDs are prefixed: itm_ (items), ann_ (annotations), tag_ (tags). " +
          "Use order=library_position for the reading list and archive, and order=inbox_position for the inbox.",
      });
      break;
    }
    case "ping":
      response = reply(id, {});
      break;
    case "tools/list": {
      const readonly = ctx.isReadonly();
      response = reply(id, { tools: TOOLS.filter((t) => !(readonly && t.write)).map(describeTool) });
      break;
    }
    case "tools/call": {
      const result = await callTool(ctx, params);
      response = result === null ? fail(id, INVALID_PARAMS, `Unknown tool: ${params.name}`) : reply(id, result);
      break;
    }
    default:
      response = fail(id, METHOD_NOT_FOUND, `Method not found: ${req.method}`);
  }
  return isNotification ? null : response;
}

// --- Stdio transport ---

export async function runMcpServer(ctx: ServerContext): Promise<void> {
  const write = (res: JsonRpcResponse) => process.stdout.write(JSON.stringify(res) + "\n");
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const pending = new Set<Promise<void>>();

  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      write(fail(null, PARSE_ERROR, "Parse error"));
      continue;
    }
    const task = handleMessage(msg, ctx)
      .then((res) => {
        if (res) write(res);
      })
      .catch((err) => {
        console.error(`matter mcp: ${(err as Error).message}`);
      });
    pending.add(task);
    task.finally(() => pending.delete(task));
  }
  await Promise.all(pending);
}
