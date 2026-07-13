import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../google-auth", () => ({ getCalendarToken: vi.fn(async () => "tok") }));

import { type BatchOp, batchWrite, GcalHttpError } from "../gcal";
import type { GEvent } from "../map";

const body: GEvent = { id: "vega7431", summary: "Task" };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const res = (status: number, text = ""): Response =>
  ({ status, ok: status >= 200 && status < 300, text: async () => text }) as unknown as Response;

/** Build a fake multipart/mixed batch response with one part per entry. */
const reply = (parts: { id: string; status: number }[], boundary = "batch_resp"): string =>
  `${parts
    .map(
      (p) =>
        `--${boundary}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-ID: response-${p.id}\r\n\r\n` +
        `HTTP/1.1 ${p.status} ${p.status < 300 ? "OK" : "ERR"}\r\n` +
        `Content-Type: application/json\r\n\r\n{}\r\n\r\n`,
    )
    .join("")}--${boundary}--\r\n`;

describe("batchWrite — request framing", () => {
  it("POSTs one multipart/mixed body to the per-API batch endpoint", async () => {
    fetchMock.mockResolvedValueOnce(res(200, ""));
    const ops: BatchOp[] = [
      { kind: "insert", id: "vegaA", body },
      { kind: "patch", id: "vegaB", body },
      { kind: "delete", id: "vegaC" },
    ];
    await batchWrite("cal", ops);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/batch/calendar/v3");
    expect(init.headers["Content-Type"]).toMatch(/^multipart\/mixed; boundary=/);
    const b = init.body as string;
    expect(b).toContain("Content-Type: application/http");
    expect(b).toContain("Content-ID: vegaA");
    expect(b).toContain("POST /calendar/v3/calendars/cal/events");
    expect(b).toContain("PATCH /calendar/v3/calendars/cal/events/vegaB");
    expect(b).toContain("DELETE /calendar/v3/calendars/cal/events/vegaC");
    expect(b.trimEnd().endsWith("--")).toBe(true); // closing boundary
  });

  it("omits a JSON body on a DELETE sub-request", async () => {
    fetchMock.mockResolvedValueOnce(res(200, ""));
    await batchWrite("cal", [{ kind: "delete", id: "vegaC" }]);
    const b = fetchMock.mock.calls[0][1].body as string;
    const sub = b.slice(b.indexOf("DELETE"));
    expect(sub).not.toContain("application/json");
  });
});

describe("batchWrite — response parsing", () => {
  it("maps results by Content-ID, not by order", async () => {
    // response lists the parts in the reverse of the request order
    fetchMock.mockResolvedValueOnce(
      res(
        200,
        reply([
          { id: "vegaB", status: 404 },
          { id: "vegaA", status: 200 },
        ]),
      ),
    );
    const out = await batchWrite("cal", [
      { kind: "insert", id: "vegaA", body },
      { kind: "delete", id: "vegaB" },
    ]);
    expect(out.find((r) => r.id === "vegaA")?.status).toBe(200);
    expect(out.find((r) => r.id === "vegaB")?.status).toBe(404);
  });

  it("returns a transient result for an op with no matching part (self-heals next cycle)", async () => {
    fetchMock.mockResolvedValueOnce(res(200, ""));
    const [r] = await batchWrite("cal", [{ kind: "insert", id: "vegaA", body }]);
    expect(r).toEqual({ id: "vegaA", status: 0, class: "transient" });
  });
});

describe("batchWrite — per-op classification", () => {
  it.each([
    ["insert", 200, "ok"],
    ["insert", 409, "needs-patch"],
    ["patch", 200, "ok"],
    ["delete", 404, "ok"],
    ["delete", 410, "ok"],
    ["insert", 401, "auth"],
    ["insert", 403, "transient"],
    ["insert", 429, "transient"],
    ["insert", 500, "transient"],
  ] as const)("classifies %s %d as %s", async (kind, status, expected) => {
    fetchMock.mockResolvedValueOnce(res(200, reply([{ id: "vega1", status }])));
    const [r] = await batchWrite("cal", [{ kind, id: "vega1", body }]);
    expect(r.class).toBe(expected);
  });
});

describe("batchWrite — chunking & envelope faults", () => {
  it("splits >50 ops into separate batch requests", async () => {
    fetchMock.mockResolvedValue(res(200, ""));
    const ops: BatchOp[] = Array.from({ length: 120 }, (_, i) => ({
      kind: "delete",
      id: `vega${i}`,
    }));
    const out = await batchWrite("cal", ops);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 50 + 50 + 20
    expect(out).toHaveLength(120);
  });

  it("throws GcalHttpError on an envelope-level fault (401/429)", async () => {
    fetchMock.mockResolvedValueOnce(res(401));
    await expect(batchWrite("cal", [{ kind: "delete", id: "vegaA" }])).rejects.toBeInstanceOf(
      GcalHttpError,
    );
  });
});
