import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar, isoDaysFromToday, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import type { GoogleCalendarClient } from "../google-client";
import { type ReconcileDeps, runReconcile } from "../reconcile";
import { writeGcalAccount } from "../token-store";

const ZONE = "America/Toronto";

type WriteCounter = { writes: number };

/** Every Google mutation fires a watch notification, so a settled sync must make exactly zero. */
function countGoogleWrites(
  client: GoogleCalendarClient,
  counter: WriteCounter,
): GoogleCalendarClient {
  return {
    ...client,
    insertEvent: (calendarId, body) => {
      counter.writes += 1;
      return client.insertEvent(calendarId, body);
    },
    patchEvent: (calendarId, eventId, body) => {
      counter.writes += 1;
      return client.patchEvent(calendarId, eventId, body);
    },
    deleteEvent: (calendarId, eventId) => {
      counter.writes += 1;
      return client.deleteEvent(calendarId, eventId);
    },
  };
}

describe("reconcile convergence (a settled sync must not write to Google)", () => {
  let server: TestServer;
  const counter: WriteCounter = { writes: 0 };
  let deps: ReconcileDeps;

  const connectZoned = async (uid: string, writeCalendarId: string, readCalendarIds?: string[]) => {
    await connectCalendar(server, uid, { writeCalendarId, readCalendarIds });
    await writeGcalAccount(server.firestore, uid, { timeZone: ZONE });
  };

  const countWritesOfSettledReconcile = async (uid: string): Promise<number> => {
    counter.writes = 0;
    await runReconcile(deps, uid);
    return counter.writes;
  };

  beforeAll(async () => {
    server = await bootTestServer();
    deps = {
      ...server.reconcileDeps,
      getClient: async (uid) =>
        countGoogleWrites(await server.reconcileDeps.getClient(uid), counter),
    };
  });
  afterAll(async () => {
    await server.close();
  });

  it("stops writing after a timed task is pushed", async () => {
    const uid = "u-converge-timed";
    await connectZoned(uid, "cal-converge-timed");
    await upsertTask(server, uid, "t-timed", { date: isoDaysFromToday(2), time: "09:00" });

    counter.writes = 0;
    await runReconcile(deps, uid);
    expect(counter.writes).toBeGreaterThan(0);

    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
  });

  it("stops writing after an all-day task is pushed", async () => {
    const uid = "u-converge-allday";
    await connectZoned(uid, "cal-converge-allday");
    await upsertTask(server, uid, "t-allday", { date: isoDaysFromToday(3), time: null });

    counter.writes = 0;
    await runReconcile(deps, uid);
    expect(counter.writes).toBeGreaterThan(0);

    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
  });

  it("stops writing after a habit-slot task is pushed", async () => {
    const uid = "u-converge-habit";
    const slotDate = isoDaysFromToday(1);
    await connectZoned(uid, "cal-converge-habit");
    await upsertTask(server, uid, "t-habit", {
      kind: "habit",
      habitId: "h-1",
      slotDate,
      date: slotDate,
      time: "07:30",
    });

    counter.writes = 0;
    await runReconcile(deps, uid);
    expect(counter.writes).toBeGreaterThan(0);

    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
  });

  it("stops writing when a read calendar's lived events are only mirrored", async () => {
    const uid = "u-converge-lived";
    await connectZoned(uid, "cal-converge-lived-write", ["cal-converge-lived-read"]);
    server.google.seedEvent("cal-converge-lived-read", {
      id: "lived-1",
      summary: "standup",
      start: { dateTime: `${isoDaysFromToday(1)}T10:00:00-04:00`, timeZone: ZONE },
    });

    await runReconcile(deps, uid);

    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
    expect(await countWritesOfSettledReconcile(uid)).toBe(0);
  });
});
