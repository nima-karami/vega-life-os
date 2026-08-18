import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday } from "../../../test/calendar-fixtures";
import { livedEvent } from "../../../test/data-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-orphan";
const SERIES_ID = "series-standup";

/** Rows no pull can reach: a de-selected calendar, and instances of a series Google cancelled whole. */
describe("lived lane heals unreachable mirror rows", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("drops a plain row whose calendar is no longer synced", async () => {
    const uid = "u-orphan-plain";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-live"],
    });
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    await repo.upsert({ ...livedEvent("ce-ghost"), calendarId: "cal-dropped" });

    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).some((row) => row.id === "ce-ghost")).toBe(false);
  });

  it("retires a tagged unreachable row once and then leaves it alone", async () => {
    const uid = "u-orphan-tagged";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-live"],
    });
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    await repo.upsert({ ...livedEvent("ce-tagged"), calendarId: "cal-dropped", valueId: "v1" });

    await runReconcile(server.reconcileDeps, uid);
    const retired = (await repo.list()).find((row) => row.id === "ce-tagged");
    expect(retired?.removedAt).toBeTruthy();
    expect(retired?.valueId).toBe("v1");

    await runReconcile(server.reconcileDeps, uid);
    const again = (await repo.list()).find((row) => row.id === "ce-tagged");
    // A re-stamped removedAt would bump the sync counter every cycle and re-pull the whole account.
    expect(again?.removedAt).toBe(retired?.removedAt);
  });

  it("never sweeps the mirror while no read calendar is configured", async () => {
    const uid = "u-orphan-unconfigured";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL, readCalendarIds: [] });
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    await repo.upsert({ ...livedEvent("ce-unconfigured"), calendarId: "cal-dropped" });

    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).some((row) => row.id === "ce-unconfigured")).toBe(true);
  });

  it("leaves nothing live on the calendar after a disconnect", async () => {
    const uid = "u-orphan-disconnect";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-live"],
    });
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    await repo.upsert({ ...livedEvent("ce-plain"), calendarId: "cal-live" });
    await repo.upsert({ ...livedEvent("ce-meaningful"), calendarId: "cal-live", valueId: "v1" });

    await server.asUid(uid).calendar.disconnect.mutate();

    const rows = await repo.list();
    expect(rows.some((row) => row.id === "ce-plain")).toBe(false);
    expect(rows.find((row) => row.id === "ce-meaningful")?.removedAt).toBeTruthy();
  });

  it("removes every instance when Google cancels the whole recurring series", async () => {
    const uid = "u-orphan-series";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-series"],
    });
    for (const offset of [1, 8, 15]) {
      server.google.seedEvent("cal-series", {
        id: `${SERIES_ID}_${offset}`,
        iCalUID: "standup@google.com",
        summary: "Standup",
        recurringEventId: SERIES_ID,
        start: { date: isoDaysFromToday(offset) },
        end: { date: isoDaysFromToday(offset + 1) },
      });
    }
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    expect((await repo.list()).filter((row) => row.recurringEventId === SERIES_ID)).toHaveLength(3);

    // Google reports a whole-series deletion as one cancelled item keyed by the series id.
    server.google.seedEvent("cal-series", {
      id: SERIES_ID,
      iCalUID: "standup@google.com",
      status: "cancelled",
    });
    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).filter((row) => row.recurringEventId === SERIES_ID)).toHaveLength(0);
  });
});
