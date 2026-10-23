import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearChunkReload, markChunkReload, shouldReloadForChunkError } from "../chunk-reload";

const chunkError = new TypeError("Failed to fetch dynamically imported module: /assets/x.js");

function stubSessionStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  return entries;
}

describe("chunk reload guard", () => {
  beforeEach(() => {
    stubSessionStorage();
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reloads once for a chunk error, then not again until cleared", () => {
    expect(shouldReloadForChunkError(chunkError)).toBe(true);
    expect(markChunkReload()).toBe(true);
    expect(shouldReloadForChunkError(chunkError)).toBe(false);

    clearChunkReload();
    expect(shouldReloadForChunkError(chunkError)).toBe(true);
  });

  it("never reloads for other errors or while offline", () => {
    expect(shouldReloadForChunkError(new Error("render threw"))).toBe(false);
    vi.stubGlobal("navigator", { onLine: false });
    expect(shouldReloadForChunkError(chunkError)).toBe(false);
  });

  it("never reloads when storage is unavailable, since nothing would stop a loop", () => {
    const throwing = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: throwing, setItem: throwing, removeItem: throwing });

    expect(shouldReloadForChunkError(chunkError)).toBe(false);
    expect(markChunkReload()).toBe(false);
    expect(() => clearChunkReload()).not.toThrow();
  });
});
