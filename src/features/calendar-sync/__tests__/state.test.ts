import { beforeEach, describe, expect, it, vi } from "vitest";

// The node test env has no localStorage; provide a minimal in-memory stand-in.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

import { getScopeVersion, getSyncToken, setScopeVersion, setSyncToken } from "../state";

beforeEach(() => mem.clear());

describe("calendar-sync device-local state", () => {
  it("round-trips per-calendar sync tokens", () => {
    setSyncToken("cal_a", "tok_a");
    setSyncToken("cal_b", "tok_b");
    expect(getSyncToken("cal_a")).toBe("tok_a");
    expect(getSyncToken("cal_b")).toBe("tok_b");
    setSyncToken("cal_a", null);
    expect(getSyncToken("cal_a")).toBeNull();
  });
  it("tracks scope version", () => {
    expect(getScopeVersion()).toBe(0);
    setScopeVersion(2);
    expect(getScopeVersion()).toBe(2);
  });
});
