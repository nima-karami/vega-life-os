import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WritableEntity } from "../../../core/repository";
import { createRepository } from "../../../core/repository";
import { connectCalendar } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-resync";

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

function livedRow(
  over: Partial<WritableEntity<"calendarEvents">>,
): WritableEntity<"calendarEvents"> {
  return {
    id: "ce-x",
    googleId: "g-x",
    iCalUID: "gx@google.com",
    calendarId: "cal",
    title: "Row",
    date: isoDaysFromNow(3),
    endDate: isoDaysFromNow(3),
    time: null,
    durationMin: 0,
    allDay: true,
    recurringEventId: null,
    googleUpdated: null,
    status: "confirmed",
    responseStatus: null,
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
    ...over,
  };
}

/** Bug 2: a full (token-expired) resync omits deletions, so the lived lane must set-difference them out. */
describe("lived lane heals deletions missed by a full resync", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("drops an in-window orphan absent from a full listing", async () => {
    const uid = "u-resync-drop";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-rs1"],
    });
    server.google.seedEvent("cal-rs1", {
      id: "g-del",
      iCalUID: "gdel@google.com",
      summary: "Doomed",
      start: { date: isoDaysFromNow(3) },
      end: { date: isoDaysFromNow(4) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    expect((await repo.list()).some((row) => row.googleId === "g-del")).toBe(true);

    await server.google.client.deleteEvent("cal-rs1", "g-del");
    server.google.expireSyncTokens("cal-rs1");
    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).some((row) => row.googleId === "g-del")).toBe(false);
  });

  it("keeps a tagged in-window orphan as a removedAt snapshot", async () => {
    const uid = "u-resync-tagged";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-rs2"],
    });
    server.google.seedEvent("cal-rs2", {
      id: "g-tag",
      iCalUID: "gtag@google.com",
      summary: "Tagged",
      start: { date: isoDaysFromNow(3) },
      end: { date: isoDaysFromNow(4) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    const row = (await repo.list()).find((event) => event.googleId === "g-tag");
    if (!row) throw new Error("mirror missing");
    await repo.upsert({ ...row, valueId: "v1" });

    await server.google.client.deleteEvent("cal-rs2", "g-tag");
    server.google.expireSyncTokens("cal-rs2");
    await runReconcile(server.reconcileDeps, uid);

    const after = (await repo.list()).find((event) => event.googleId === "g-tag");
    expect(after?.removedAt).toBeTruthy();
    expect(after?.valueId).toBe("v1");
  });

  it("does NOT drop an out-of-window row missing from a full listing", async () => {
    const uid = "u-resync-far";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-rs3"],
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    await repo.upsert(
      livedRow({
        id: "ce-far",
        googleId: "g-far-row",
        iCalUID: "gfar@google.com",
        calendarId: "cal-rs3",
        date: isoDaysFromNow(400),
        endDate: isoDaysFromNow(400),
      }),
    );

    server.google.expireSyncTokens("cal-rs3");
    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).some((event) => event.googleId === "g-far-row")).toBe(true);
  });
});
