import { describe, expect, it } from "vitest";
import { bootTestServer } from "../../../test/harness";

describe("calendar connect provisioning (real server vs emulator)", () => {
  it("provisions a VEGA write calendar on oauth callback and reports it in status", async () => {
    const server = await bootTestServer();
    try {
      const uid = "u-connect";
      const result = await server.asUid(uid).calendar.oauthCallback.mutate({ code: "test-code" });
      expect(result.connected).toBe(true);
      expect(result.writeCalendarId).toBeTruthy();

      const status = await server.asUid(uid).calendar.status.query();
      expect(status.connected).toBe(true);
      expect(status.writeCalendarId).toBe(result.writeCalendarId);
    } finally {
      await server.close();
    }
  });

  it("reuses the existing write calendar on a second callback (no duplicate)", async () => {
    const server = await bootTestServer();
    try {
      const uid = "u-reconnect";
      const first = await server.asUid(uid).calendar.oauthCallback.mutate({ code: "c1" });
      const second = await server.asUid(uid).calendar.oauthCallback.mutate({ code: "c2" });
      expect(second.writeCalendarId).toBe(first.writeCalendarId);
    } finally {
      await server.close();
    }
  });
});
