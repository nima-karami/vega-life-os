import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

import { defaultGcalConfig, readLocalGcalConfig } from "../config";

beforeEach(() => mem.clear());

describe("gcal config (device-local read)", () => {
  it("defaults to disabled, primary read calendar, events shown", () => {
    expect(readLocalGcalConfig()).toEqual({
      enabled: false,
      writeCalendarId: null,
      readCalendarIds: ["primary"],
      showGoogleEvents: true,
    });
    expect(defaultGcalConfig()).toEqual(readLocalGcalConfig());
  });

  it("reads persisted values", () => {
    localStorage.setItem("vega.gcal.enabled", "1");
    localStorage.setItem("vega.gcal.writeCalendarId", "cal_vega");
    localStorage.setItem("vega.gcal.readCalendarIds", JSON.stringify(["a", "b"]));
    localStorage.setItem("vega.gcal.showEvents", "0");
    expect(readLocalGcalConfig()).toEqual({
      enabled: true,
      writeCalendarId: "cal_vega",
      readCalendarIds: ["a", "b"],
      showGoogleEvents: false,
    });
  });

  it("migrates a legacy single calendarId into the read set", () => {
    localStorage.setItem("vega.gcal.calendarId", "primary");
    expect(readLocalGcalConfig().readCalendarIds).toEqual(["primary"]);
  });
});
