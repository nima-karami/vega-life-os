import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../google-auth", () => ({ getCalendarToken: vi.fn(async () => "tok") }));

import { useStore } from "@/core/store";
import { ensureVegaCalendar } from "../calendars";
import { defaultGcalConfig } from "../config";

type FetchResult = { ok: boolean; status: number; json?: () => Promise<unknown> };
const res = (r: FetchResult) => ({ json: async () => ({}), ...r });

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const isCalendarList = (url: string) => url.includes("users/me/calendarList");
const isCreate = (url: string, init?: RequestInit) =>
  url.endsWith("/calendars") && init?.method === "POST";

const seedStored = (writeCalendarId: string | null) =>
  useStore.setState({ gcal: { ...defaultGcalConfig(), writeCalendarId } });

beforeEach(() => {
  fetchMock.mockReset();
  seedStored("cal_stored");
});

describe("ensureVegaCalendar", () => {
  it("background: stored id gone + no VEGA in list resolves null and never creates", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isCalendarList(url))
        return res({ ok: true, status: 200, json: async () => ({ items: [] }) });
      return res({ ok: false, status: 404 });
    });

    await expect(ensureVegaCalendar(false)).resolves.toBeNull();
    const posted = fetchMock.mock.calls.some(([url, init]) => isCreate(url, init));
    expect(posted).toBe(false);
  });

  it("interactive: stored id gone + no VEGA in list creates and returns the new id", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (isCreate(url, init))
        return res({ ok: true, status: 200, json: async () => ({ id: "cal_new" }) });
      if (isCalendarList(url))
        return res({ ok: true, status: 200, json: async () => ({ items: [] }) });
      return res({ ok: false, status: 404 });
    });

    await expect(ensureVegaCalendar(true)).resolves.toBe("cal_new");
    expect(useStore.getState().gcal.writeCalendarId).toBe("cal_new");
  });

  it("returns the stored id when it still resolves, without creating", async () => {
    fetchMock.mockImplementation(async () =>
      res({ ok: true, status: 200, json: async () => ({ id: "cal_stored" }) }),
    );

    await expect(ensureVegaCalendar(false)).resolves.toBe("cal_stored");
    const posted = fetchMock.mock.calls.some(([url, init]) => isCreate(url, init));
    expect(posted).toBe(false);
  });
});
