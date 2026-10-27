import { describe, expect, test } from "bun:test";
import { MatterAPI, MatterAPIError } from "../src/api";
import { handleMessage, TOOLS, type ServerContext } from "../src/mcp";

function makeCtx(overrides: Partial<Record<keyof MatterAPI, unknown>> = {}, readonly = false) {
  const calls: { method: string; args: unknown[] }[] = [];
  const api = new Proxy({} as MatterAPI, {
    get(_, prop: string) {
      if (prop === "listAll") return MatterAPI.prototype.listAll;
      return async (...args: unknown[]) => {
        calls.push({ method: prop, args });
        const impl = overrides[prop as keyof MatterAPI];
        return typeof impl === "function" ? impl(...args) : { ok: prop };
      };
    },
  });
  const ctx: ServerContext = { api, isReadonly: () => readonly };
  return { ctx, calls };
}

const call = (name: string, args: Record<string, unknown> = {}, id = 1) => ({
  jsonrpc: "2.0" as const,
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

describe("initialize", () => {
  test("echoes a supported protocol version", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, ctx);
    expect((res?.result as any).protocolVersion).toBe("2025-03-26");
    expect((res?.result as any).serverInfo.name).toBe("matter");
    expect((res?.result as any).capabilities.tools).toBeDefined();
  });

  test("falls back to the latest version for an unknown one", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, ctx);
    expect((res?.result as any).protocolVersion).toBe("2025-06-18");
  });
});

describe("protocol", () => {
  test("notifications get no response", async () => {
    const { ctx } = makeCtx();
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx)).toBeNull();
  });

  test("ping returns an empty result", async () => {
    const { ctx } = makeCtx();
    expect(await handleMessage({ jsonrpc: "2.0", id: "a", method: "ping" }, ctx)).toEqual({ jsonrpc: "2.0", id: "a", result: {} });
  });

  test("unknown method returns -32601", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage({ jsonrpc: "2.0", id: 2, method: "resources/list" }, ctx);
    expect(res?.error?.code).toBe(-32601);
  });

  test("malformed message returns -32600", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage({ id: 3, method: "ping" }, ctx);
    expect(res?.error?.code).toBe(-32600);
  });

  test("unknown tool returns -32602", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage(call("nope"), ctx);
    expect(res?.error?.code).toBe(-32602);
  });
});

describe("tools/list", () => {
  test("lists every tool with annotations", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const tools = (res?.result as any).tools;
    expect(tools).toHaveLength(TOOLS.length);
    const del = tools.find((t: any) => t.name === "delete_item");
    expect(del.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    const get = tools.find((t: any) => t.name === "get_item");
    expect(get.annotations.readOnlyHint).toBe(true);
  });

  test("hides write tools in readonly mode", async () => {
    const { ctx } = makeCtx({}, true);
    const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const names = (res?.result as any).tools.map((t: any) => t.name);
    expect(names).toContain("list_items");
    expect(names).not.toContain("save_item");
    expect(names).not.toContain("delete_tag");
  });
});

describe("tools/call", () => {
  test("list_items maps arguments to the API filters", async () => {
    const { ctx, calls } = makeCtx();
    const res = await handleMessage(call("list_items", { status: "queue", order: "library_position", is_favorite: true, limit: 5 }), ctx);
    expect(calls[0].method).toBe("listItems");
    expect(calls[0].args[0]).toMatchObject({ status: "queue", order: "library_position", is_favorite: true, limit: 5 });
    expect(JSON.parse((res?.result as any).content[0].text)).toEqual({ ok: "listItems" });
  });

  test("get_item requests markdown only when asked", async () => {
    const { ctx, calls } = makeCtx();
    await handleMessage(call("get_item", { id: "itm_1", include_markdown: true }), ctx);
    await handleMessage(call("get_item", { id: "itm_2" }), ctx);
    expect(calls.map((c) => c.args)).toEqual([["itm_1", "markdown"], ["itm_2", undefined]]);
  });

  test("search_items always searches items", async () => {
    const { ctx, calls } = makeCtx();
    await handleMessage(call("search_items", { query: "by:knuth" }), ctx);
    expect(calls[0].args[0]).toMatchObject({ query: "by:knuth", type: "items" });
  });

  test("update_item sends only the fields given", async () => {
    const { ctx, calls } = makeCtx();
    await handleMessage(call("update_item", { id: "itm_1", is_favorite: false }), ctx);
    expect(calls[0].args).toEqual(["itm_1", { is_favorite: false }]);
  });

  test("update_annotation passes null to clear a note", async () => {
    const { ctx, calls } = makeCtx();
    await handleMessage(call("update_annotation", { id: "ann_1", note: null }), ctx);
    expect(calls[0].args).toEqual(["ann_1", { note: null }]);
  });

  test("list_annotations with all=true follows cursors", async () => {
    const pages: Record<string, unknown> = {
      first: { object: "list", results: [{ id: "ann_1" }], has_more: true, next_cursor: "c2" },
      c2: { object: "list", results: [{ id: "ann_2" }], has_more: false, next_cursor: null },
    };
    const { ctx } = makeCtx({ listAnnotations: (f: { cursor?: string }) => pages[f.cursor ?? "first"] });
    const res = await handleMessage(call("list_annotations", { item_id: "itm_1", all: true }), ctx);
    const body = JSON.parse((res?.result as any).content[0].text);
    expect(body.results.map((a: any) => a.id)).toEqual(["ann_1", "ann_2"]);
    expect(body.has_more).toBe(false);
  });

  test("delete tools return a confirmation", async () => {
    const { ctx, calls } = makeCtx();
    const res = await handleMessage(call("remove_tag_from_item", { item_id: "itm_1", tag_id: "tag_9" }), ctx);
    expect(calls[0]).toEqual({ method: "removeTagFromItem", args: ["itm_1", "tag_9"] });
    expect(JSON.parse((res?.result as any).content[0].text).ok).toBe(true);
  });

  test("write tools fail as tool errors in readonly mode", async () => {
    const { ctx, calls } = makeCtx({}, true);
    const res = await handleMessage(call("save_item", { url: "https://example.com" }), ctx);
    expect((res?.result as any).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test("missing required argument is a tool error", async () => {
    const { ctx, calls } = makeCtx();
    const res = await handleMessage(call("get_item", {}), ctx);
    expect((res?.result as any).isError).toBe(true);
    expect((res?.result as any).content[0].text).toContain("'id' is required");
    expect(calls).toHaveLength(0);
  });

  test("wrong argument type is a tool error", async () => {
    const { ctx } = makeCtx();
    const res = await handleMessage(call("list_items", { limit: "5" }), ctx);
    expect((res?.result as any).content[0].text).toContain("'limit' must be a number");
  });

  test("API errors become tool errors with the error code", async () => {
    const { ctx } = makeCtx({
      getItem: () => {
        throw new MatterAPIError(404, "not_found", "Item not found");
      },
    });
    const res = await handleMessage(call("get_item", { id: "itm_x" }), ctx);
    expect((res?.result as any).isError).toBe(true);
    expect((res?.result as any).content[0].text).toBe("not_found: Item not found");
  });
});
