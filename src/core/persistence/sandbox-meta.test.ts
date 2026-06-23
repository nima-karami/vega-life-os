import { describe, expect, it } from "vitest";
import { isSandboxDirty } from "./sandbox-meta";

describe("isSandboxDirty", () => {
  it("true when the flag is explicitly set", () => {
    expect(isSandboxDirty(true, false)).toBe(true);
    expect(isSandboxDirty(true, true)).toBe(true);
  });
  it("false when the flag is explicitly clean", () => {
    expect(isSandboxDirty(false, true)).toBe(false);
    expect(isSandboxDirty(false, false)).toBe(false);
  });
  it("fails safe: flag missing but rows exist → dirty", () => {
    expect(isSandboxDirty(undefined, true)).toBe(true);
    expect(isSandboxDirty(undefined, false)).toBe(false);
  });
});
