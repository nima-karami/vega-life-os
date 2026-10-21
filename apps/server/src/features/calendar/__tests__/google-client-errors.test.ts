import { google } from "googleapis";
import { afterEach, describe, expect, it } from "vitest";
import { createGoogleClient, GoogleHttpError, SyncTokenExpiredError } from "../google-client";

function stubGoogleStatus(status: number) {
  const errorBody = JSON.stringify({ error: { code: status, message: `status ${status}` } });
  google.options({
    retry: false,
    fetchImplementation: async () =>
      new Response(errorBody, { status, headers: { "content-type": "application/json" } }),
  });
}

afterEach(() => {
  google.options({});
});

describe("real google client error classification", () => {
  it("treats a 404 or 410 on delete as already gone", async () => {
    stubGoogleStatus(404);
    await expect(createGoogleClient("token").deleteEvent("cal", "evt")).resolves.toBeUndefined();
    stubGoogleStatus(410);
    await expect(createGoogleClient("token").deleteEvent("cal", "evt")).resolves.toBeUndefined();
  });

  it("maps a failed write to a GoogleHttpError carrying the status", async () => {
    stubGoogleStatus(403);
    await expect(createGoogleClient("token").patchEvent("cal", "evt", {})).rejects.toEqual(
      new GoogleHttpError(403),
    );
  });

  it("maps a 410 on a sync-token list to SyncTokenExpiredError", async () => {
    stubGoogleStatus(410);
    await expect(
      createGoogleClient("token").listEvents("cal", { syncToken: "stale" }),
    ).rejects.toBeInstanceOf(SyncTokenExpiredError);
  });

  it("maps a 429 on a windowed list to a GoogleHttpError", async () => {
    stubGoogleStatus(429);
    await expect(
      createGoogleClient("token").listEvents("cal", { window: { backDays: 1, fwdDays: 1 } }),
    ).rejects.toEqual(new GoogleHttpError(429));
  });
});
