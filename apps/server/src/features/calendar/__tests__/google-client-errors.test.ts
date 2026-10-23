import { describe, expect, it } from "vitest";
import { createGoogleClient, GoogleHttpError, SyncTokenExpiredError } from "../google-client";

function createClientAnswering(status: number) {
  const errorBody = JSON.stringify({ error: { code: status, message: `status ${status}` } });
  return createGoogleClient("token", {
    retry: false,
    fetchImplementation: async () =>
      new Response(errorBody, { status, headers: { "content-type": "application/json" } }),
  });
}

describe("real google client error classification", () => {
  it("treats a 404 or 410 on delete as already gone", async () => {
    await expect(createClientAnswering(404).deleteEvent("cal", "evt")).resolves.toBeUndefined();
    await expect(createClientAnswering(410).deleteEvent("cal", "evt")).resolves.toBeUndefined();
  });

  it("maps a failed write to a GoogleHttpError carrying the status", async () => {
    await expect(createClientAnswering(403).patchEvent("cal", "evt", {})).rejects.toEqual(
      new GoogleHttpError(403),
    );
  });

  it("maps a 410 on a sync-token list to SyncTokenExpiredError", async () => {
    await expect(
      createClientAnswering(410).listEvents("cal", { syncToken: "stale" }),
    ).rejects.toBeInstanceOf(SyncTokenExpiredError);
  });

  it("maps a 429 on a windowed list to a GoogleHttpError", async () => {
    await expect(
      createClientAnswering(429).listEvents("cal", { window: { backDays: 1, fwdDays: 1 } }),
    ).rejects.toEqual(new GoogleHttpError(429));
  });
});
