import type { CalendarEvent } from "@vega/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-lived";
const EXT_CAL = "cal-external";
const EVENT_DATE = isoDaysFromToday(2);

describe("lived lane: external calendars ⇄ calendarEvents mirror (server-owned)", () => {
  let server: TestServer;
  const mirror = (uid: string) => createRepository(server.firestore, uid, "calendarEvents");
  const rowFor = async (uid: string, googleId: string): Promise<CalendarEvent | undefined> =>
    (await mirror(uid).list()).find((event) => event.googleId === googleId);

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("mirrors an external event, survives a VEGA edit over an older external update, and deletes without re-creating", async () => {
    const uid = "u-lived";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL, readCalendarIds: [EXT_CAL] });
    server.google.seedEvent(EXT_CAL, {
      id: "g-ext-1",
      iCalUID: "ical-ext-1",
      summary: "Standup",
      start: { dateTime: `${EVENT_DATE}T09:00:00+00:00` },
      end: { dateTime: `${EVENT_DATE}T09:30:00+00:00` },
      updated: "2026-07-13T08:00:00.000Z",
      status: "confirmed",
    });

    await runReconcile(server.reconcileDeps, uid);
    const mirrored = await rowFor(uid, "g-ext-1");
    expect(mirrored?.title).toBe("Standup");
    expect(mirrored?.calendarId).toBe(EXT_CAL);

    // A VEGA edit newer than the external update must win and be pushed to Google.
    const { updatedAt: _u, fieldUpdatedAt: _f, ...writable } = mirrored as CalendarEvent;
    await mirror(uid).upsert({
      ...writable,
      note: "prep talking points",
      vegaEditedAt: "2026-07-13T12:00:00.000Z",
    });

    await runReconcile(server.reconcileDeps, uid);
    const afterEdit = await rowFor(uid, "g-ext-1");
    expect(afterEdit?.note).toBe("prep talking points");
    expect(afterEdit?.vegaEditedAt).toBeNull();

    // A VEGA-side delete removes the external counterpart and is not re-created on the next pull.
    const { updatedAt: _u2, fieldUpdatedAt: _f2, ...editable } = afterEdit as CalendarEvent;
    await mirror(uid).upsert({ ...editable, pendingDelete: true });
    await runReconcile(server.reconcileDeps, uid);
    expect(await rowFor(uid, "g-ext-1")).toBeUndefined();

    await runReconcile(server.reconcileDeps, uid);
    expect(await rowFor(uid, "g-ext-1")).toBeUndefined();
    expect(server.google.eventById(EXT_CAL, "g-ext-1")?.status).toBe("cancelled");
  });
});
