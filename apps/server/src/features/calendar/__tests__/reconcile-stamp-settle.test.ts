import { subDays } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { listChannelsForUid } from "../channel-registry";
import { getGoogleEventId } from "../event-map";
import type { MirrorRow } from "../gcal-mirror";
import { type GoogleCalendarClient, GoogleHttpError } from "../google-client";
import { type ReconcileDeps, runReconcile } from "../reconcile";
import { readGcalAccount } from "../token-store";

/** The quiet gate may only trust a stamp from a run that left nothing behind to redo. */
describe("reconcile stamp: only a settled run may vouch for the next quiet one", () => {
  let server: TestServer;

  const depsWith = (client: GoogleCalendarClient): ReconcileDeps => ({
    ...server.reconcileDeps,
    getClient: async () => client,
  });

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("a failed channel watch leaves no stamp, so the next run re-registers it", async () => {
    const uid = "u-stamp-watch";
    await connectCalendar(server, uid, {
      writeCalendarId: "cal-write-watch",
      readCalendarIds: ["cal-read-watch"],
    });
    const google = server.google.client;
    let failuresLeft = 1;
    const flaky: GoogleCalendarClient = {
      ...google,
      watch: async (calendarId, request) => {
        if (failuresLeft > 0) {
          failuresLeft -= 1;
          throw new GoogleHttpError(403);
        }
        return google.watch(calendarId, request);
      },
    };

    await runReconcile(depsWith(flaky), uid);
    expect((await readGcalAccount(server.firestore, uid))?.lastReconcile).toBeNull();
    expect(await listChannelsForUid(server.firestore, uid)).toHaveLength(1);

    await runReconcile(depsWith(flaky), uid);
    expect(await listChannelsForUid(server.firestore, uid)).toHaveLength(2);
    expect((await readGcalAccount(server.firestore, uid))?.lastReconcile).toBeTruthy();
  });

  it("a task written mid-run is still pushed by the next gated run", async () => {
    const uid = "u-stamp-midrun";
    const writeCal = "cal-write-midrun";
    await connectCalendar(server, uid, { writeCalendarId: writeCal });
    const first = await upsertTask(server, uid, "t-first", {
      date: isoDaysFromToday(2),
      time: "09:00",
    });
    for (let pass = 0; pass < 3; pass += 1) await runReconcile(server.reconcileDeps, uid);
    await upsertTask(server, uid, "t-first", { date: first.date, time: "10:00" });

    const google = server.google.client;
    let isHookArmed = true;
    const racing: GoogleCalendarClient = {
      ...google,
      patchEvent: async (calendarId, eventId, body) => {
        if (isHookArmed) {
          isHookArmed = false;
          await upsertTask(server, uid, "t-late", { date: isoDaysFromToday(3), time: "11:00" });
        }
        return google.patchEvent(calendarId, eventId, body);
      },
    };
    await runReconcile(depsWith(racing), uid);
    expect(isHookArmed).toBe(false);

    await runReconcile(server.reconcileDeps, uid);
    const late = await createRepository(server.firestore, uid, "tasks").get("t-late");
    const lateEventId = getGoogleEventId(late as NonNullable<typeof late>);
    expect(server.google.eventById(writeCal, lateEventId)?.status).toBe("confirmed");
  });

  it("drops cancelled mirror rows past tombstone retention and keeps recent ones", async () => {
    const uid = "u-stamp-prune";
    await connectCalendar(server, uid, { writeCalendarId: "cal-write-prune" });
    await runReconcile(server.reconcileDeps, uid);
    const mirror = server.firestore.collection(`users/${uid}/gcalMirror`);
    const cancelledRow = (eventId: string, updated: string | null): MirrorRow => ({
      eventId,
      summary: "",
      start: {},
      status: "cancelled",
      updated,
      vegaKey: null,
    });
    const now = new Date();
    await mirror.doc("vegaold").set(cancelledRow("vegaold", subDays(now, 40).toISOString()));
    await mirror.doc("vegalegacy").set(cancelledRow("vegalegacy", null));
    await mirror.doc("vegarecent").set(cancelledRow("vegarecent", subDays(now, 1).toISOString()));

    await runReconcile(server.reconcileDeps, uid, { force: true });

    const remaining = (await mirror.get()).docs.map((doc) => doc.id).sort();
    expect(remaining).toEqual(["vegarecent"]);
  });
});
