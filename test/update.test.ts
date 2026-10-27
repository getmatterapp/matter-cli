import { describe, expect, test } from "bun:test";
import { isSourceRun } from "../src/update";

describe("isSourceRun", () => {
  test("detects the bun runtime", () => {
    expect(isSourceRun("/Users/me/.bun/bin/bun")).toBe(true);
    expect(isSourceRun("C:/Users/me/.bun/bin/bun.exe")).toBe(true);
  });

  test("treats the compiled binary as installed", () => {
    expect(isSourceRun("/Users/me/.matter/bin/matter")).toBe(false);
    expect(isSourceRun("/usr/local/bin/matter-darwin-arm64")).toBe(false);
    expect(isSourceRun("C:/Users/me/.matter/bin/matter.exe")).toBe(false);
  });

  test("is true for this test process", () => {
    expect(isSourceRun()).toBe(true);
  });
});
