import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../google-auth", () => ({ getCalendarToken: vi.fn(async () => "tok") }));

import { insertEvent } from "../gcal";
import type { GEvent } from "../map";

const body: GEvent = { id: "vega7431", summary: "Task" };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const res = (status: number, json: unknown = {}): Response =>
  ({ status, ok: status >= 200 && status < 300, json: async () => json }) as Response;

describe("insertEvent", () => {
  it("converges via PATCH (no throw) when the deterministic id already exists (409)", async () => {
    fetchMock.mockResolvedValueOnce(res(409)).mockResolvedValueOnce(res(200));
    const out = await insertEvent("cal", body);
    expect(out).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain(`/events/${body.id}`);
    expect(init.method).toBe("PATCH");
  });

  it("returns the parsed json and makes no PATCH on a normal 200 insert", async () => {
    const created = { id: "vega7431", summary: "Task", status: "confirmed" };
    fetchMock.mockResolvedValueOnce(res(200, created));
    const out = await insertEvent("cal", body);
    expect(out).toEqual(created);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
