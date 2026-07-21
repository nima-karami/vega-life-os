import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { listChannelsForUid } from "../channel-registry";
import { readGcalAccount } from "../token-store";

describe("calendar connect provisioning (real server vs emulator)", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("provisions a VEGA write calendar on oauth callback and reports it in status", async () => {
    const uid = "u-connect";
    const result = await server
      .asUid(uid)
      .calendar.oauthCallback.mutate({ code: "test-code", timeZone: "UTC" });
    expect(result.connected).toBe(true);
    expect(result.writeCalendarId).toBeTruthy();

    const status = await server.asUid(uid).calendar.status.query();
    expect(status.connected).toBe(true);
    expect(status.writeCalendarId).toBe(result.writeCalendarId);
  });

  it("reuses the existing write calendar on a second callback (no duplicate)", async () => {
    const uid = "u-reconnect";
    const first = await server
      .asUid(uid)
      .calendar.oauthCallback.mutate({ code: "c1", timeZone: "UTC" });
    const second = await server
      .asUid(uid)
      .calendar.oauthCallback.mutate({ code: "c2", timeZone: "UTC" });
    expect(second.writeCalendarId).toBe(first.writeCalendarId);
  });

  it("oauthCallback seeds the primary read calendar, stores the zone, registers channels, and reconciles", async () => {
    const uid = "u-provision-full";
    server.google.seedCalendarInfo({
      id: "primary-real-id",
      summary: "Personal",
      primary: true,
      backgroundColor: "#7986cb",
    });
    const result = await server
      .asUid(uid)
      .calendar.oauthCallback.mutate({ code: "code-1", timeZone: "America/Toronto" });
    expect(result.connected).toBe(true);

    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.timeZone).toBe("America/Toronto");
    expect(account?.readCalendarIds).toEqual(["primary-real-id"]);
    expect(account?.calendarPrefs?.["primary-real-id"]).toMatchObject({
      visible: true,
      summary: "Personal",
    });
    // One channel per synced calendar: the write calendar + the primary read calendar.
    const channels = await listChannelsForUid(server.firestore, uid);
    expect(channels.map((channel) => channel.calendarId).sort()).toEqual(
      [account?.writeCalendarId, "primary-real-id"].sort(),
    );
  });

  it("a callback with no refresh token fails with GCAL_NO_REFRESH_TOKEN", async () => {
    server.google.failNextExchangeWithoutRefreshToken();
    await expect(
      server.asUid("u-no-rt").calendar.oauthCallback.mutate({ code: "c", timeZone: "UTC" }),
    ).rejects.toMatchObject({ message: "GCAL_NO_REFRESH_TOKEN" });
  });
});
