import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FreshStartModule = typeof import("../fresh-start");

let freshStart: FreshStartModule;

beforeEach(async () => {
  vi.resetModules();
  freshStart = await import("../fresh-start");
});

const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";
const SUNDAY = "2026-10-25";

describe("shouldShowFreshStart", () => {
  it("shows on a Monday viewed as today", () => {
    expect(freshStart.shouldShowFreshStart(MONDAY, MONDAY, null)).toBe(true);
  });

  it("stays hidden on any other weekday", () => {
    expect(freshStart.shouldShowFreshStart(TUESDAY, TUESDAY, null)).toBe(false);
    expect(freshStart.shouldShowFreshStart(SUNDAY, SUNDAY, null)).toBe(false);
  });

  it("stays hidden while another day is in view", () => {
    expect(freshStart.shouldShowFreshStart(MONDAY, TUESDAY, null)).toBe(false);
  });

  it("stays hidden once dismissed for this week, and returns the next Monday", () => {
    expect(freshStart.shouldShowFreshStart(MONDAY, MONDAY, MONDAY)).toBe(false);
    expect(freshStart.shouldShowFreshStart("2026-10-26", "2026-10-26", MONDAY)).toBe(true);
  });

  it("shows on a Monday that opens a new year", () => {
    expect(freshStart.shouldShowFreshStart("2029-01-01", "2029-01-01", "2028-12-25")).toBe(true);
  });
});

describe("fresh-start dismissal storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ignores a corrupt stored value", () => {
    vi.stubGlobal("localStorage", { getItem: () => "soon", setItem: () => {} });
    expect(freshStart.readFreshStartDismissal()).toBeNull();
  });

  it("round-trips the dismissed week through storage", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    freshStart.dismissFreshStart(MONDAY);
    expect(stored.get("vega.freshStartDismissedFor")).toBe(MONDAY);
    expect(freshStart.readFreshStartDismissal()).toBe(MONDAY);
  });

  it("keeps the dismissal for the session when storage fails", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    freshStart.dismissFreshStart("2026-11-02");
    expect(freshStart.readFreshStartDismissal()).toBe("2026-11-02");
  });
});
