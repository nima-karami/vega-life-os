import { beforeEach, describe, expect, it, vi } from "vitest";

// The node test env has no localStorage; provide a minimal in-memory stand-in.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

import {
  getReadCalendarIds,
  getScopeVersion,
  getSyncToken,
  getWriteCalendarId,
  migrateLegacyCalendarId,
  setReadCalendarIds,
  setScopeVersion,
  setSyncToken,
  setWriteCalendarId,
} from "../state";

beforeEach(() => mem.clear());

describe("calendar-sync state", () => {
  it("round-trips read calendars and per-calendar tokens", () => {
    setReadCalendarIds(["cal_a", "cal_b"]);
    expect(getReadCalendarIds()).toEqual(["cal_a", "cal_b"]);
    setSyncToken("cal_a", "tok_a");
    setSyncToken("cal_b", "tok_b");
    expect(getSyncToken("cal_a")).toBe("tok_a");
    expect(getSyncToken("cal_b")).toBe("tok_b");
    setSyncToken("cal_a", null);
    expect(getSyncToken("cal_a")).toBeNull();
  });
  it("defaults read calendars to [primary] and write calendar to null", () => {
    expect(getReadCalendarIds()).toEqual(["primary"]);
    expect(getWriteCalendarId()).toBeNull();
  });
  it("tracks scope version", () => {
    expect(getScopeVersion()).toBe(0);
    setScopeVersion(2);
    expect(getScopeVersion()).toBe(2);
  });
  it("migrates a legacy single calendarId into readCalendarIds but NOT writeCalendarId", () => {
    localStorage.setItem("vega.gcal.calendarId", "primary");
    migrateLegacyCalendarId();
    expect(getReadCalendarIds()).toEqual(["primary"]);
    expect(getWriteCalendarId()).toBeNull(); // engine auto-creates the VEGA calendar instead
    setWriteCalendarId("cal_vega");
    expect(getWriteCalendarId()).toBe("cal_vega");
  });
});
