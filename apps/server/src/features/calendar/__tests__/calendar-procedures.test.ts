import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { listChannelsForUid } from "../channel-registry";
import { readGcalAccount, writeGcalAccount } from "../token-store";

describe("calendar selection and sync procedures", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("listCalendars returns the user's calendars without the VEGA write calendar", async () => {
    const uid = "u-proc-list";
    await connectCalendar(server, uid, { writeCalendarId: "vega-cal-id" });
    server.google.seedCalendarInfo({
      id: "vega-cal-id",
      summary: "VEGA",
      primary: false,
      backgroundColor: null,
    });
    server.google.seedCalendarInfo({
      id: "cal-work",
      summary: "Work",
      primary: false,
      backgroundColor: "#33b679",
    });
    const calendars = await server.asUid(uid).calendar.listCalendars.query();
    expect(calendars.map((calendar) => calendar.id)).toEqual(["cal-work"]);
  });

  it("setReadCalendars registers/stops channels, prunes tokens and mirrors, and enforces the cap", async () => {
    const uid = "u-proc-select";
    await connectCalendar(server, uid, {
      writeCalendarId: "cal-w-proc",
      readCalendarIds: ["cal-old"],
    });
    await writeGcalAccount(server.firestore, uid, {
      calendarPrefs: { "cal-old": { visible: true, summary: "Old", color: null } },
    });
    server.google.seedCalendarInfo({
      id: "cal-new",
      summary: "New",
      primary: false,
      backgroundColor: null,
    });
    const outcome = await server.asUid(uid).calendar.setReadCalendars.mutate({
      ids: ["cal-new"],
    });
    expect(outcome.readCalendarIds).toEqual(["cal-new"]);
    const channels = await listChannelsForUid(server.firestore, uid);
    expect(channels.some((channel) => channel.calendarId === "cal-new")).toBe(true);
    expect(channels.some((channel) => channel.calendarId === "cal-old")).toBe(false);
    const selected = await readGcalAccount(server.firestore, uid);
    expect(selected?.calendarPrefs?.["cal-old"]).toBeUndefined();
    expect(selected?.calendarPrefs?.["cal-new"]?.visible).toBe(true);

    const tooMany = Array.from({ length: 11 }, (_, index) => `cal-${index}`);
    await expect(
      server.asUid(uid).calendar.setReadCalendars.mutate({ ids: tooMany }),
    ).rejects.toMatchObject({ message: expect.stringContaining("10") });
  });

  it("syncNow reports soft reasons instead of throwing", async () => {
    const uid = "u-proc-sync";
    await connectCalendar(server, uid, { writeCalendarId: "cal-w-sync" });
    const ok = await server.asUid(uid).calendar.syncNow.mutate();
    expect(ok.synced).toBe(true);

    await writeGcalAccount(server.firestore, uid, {
      backoff: { failures: 3, nextAllowedAt: "2999-01-01T00:00:00.000Z" },
    });
    const backingOff = await server.asUid(uid).calendar.syncNow.mutate();
    expect(backingOff).toEqual({ synced: false, reason: "backing_off" });
  });

  it("setCalendarVisibility and setTimeZone persist to the account", async () => {
    const uid = "u-proc-prefs";
    await connectCalendar(server, uid, {
      writeCalendarId: "cal-w-prefs",
      readCalendarIds: ["cal-vis"],
    });
    await server.asUid(uid).calendar.setCalendarVisibility.mutate({
      calendarId: "cal-vis",
      visible: false,
    });
    await server.asUid(uid).calendar.setTimeZone.mutate({ timeZone: "Asia/Tokyo" });
    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.calendarPrefs?.["cal-vis"]?.visible).toBe(false);
    expect(account?.timeZone).toBe("Asia/Tokyo");
  });

  it("setTimeZone rejects an invalid IANA zone", async () => {
    const uid = "u-proc-badzone";
    await connectCalendar(server, uid, { writeCalendarId: "cal-w-badzone" });
    await expect(
      server.asUid(uid).calendar.setTimeZone.mutate({ timeZone: "Not/AZone" }),
    ).rejects.toMatchObject({ message: expect.stringContaining("invalid timezone") });
  });
});
