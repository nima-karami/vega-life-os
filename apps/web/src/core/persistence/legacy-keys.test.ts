import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLegacyStreakRules } from "./legacy-keys";

function stubStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  return data;
}

describe("clearLegacyStreakRules", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("removes only the retired streak-rules key", () => {
    const data = stubStorage({ "vega.streakRules": "{}", "vega.other": "keep" });
    clearLegacyStreakRules();
    expect(data.has("vega.streakRules")).toBe(false);
    expect(data.get("vega.other")).toBe("keep");
  });

  it("does not throw when storage access throws", () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => clearLegacyStreakRules()).not.toThrow();
  });

  it("does not throw when there is no localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => clearLegacyStreakRules()).not.toThrow();
  });
});
