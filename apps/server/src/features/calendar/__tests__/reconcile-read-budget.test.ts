import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initAdmin } from "../../../core/firebase-admin";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday, upsertTask } from "../../../test/calendar-fixtures";
import { resolveEmulatorConfig } from "../../../test/emulator";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { getGoogleEventId } from "../event-map";
import { runReconcile } from "../reconcile";
import { readGcalAccount, writeGcalAccount } from "../token-store";
import { type OpTally, withOpCounter } from "./firestore-op-counter";

const UID = "u-budget";
const WRITE_CAL = "cal-write-budget";
const READ_CAL = "cal-read-budget";
const TASK_COUNT = 40;
const DATA_LABELS = ["tasks", "calendarEvents", "gcalMirror", "tombstones", "meta/sync"];

const ECHO_READ_BUDGET = 7;
const IDLE_READ_BUDGET = 7;
const BOOKKEEPING_WRITE_BUDGET = 3;

const dataWrites = (tally: OpTally) =>
  DATA_LABELS.reduce((sum, label) => sum + (tally.writesBy[label] ?? 0), 0);

describe("reconcile Firestore budget: one read per run, echoes and no-op webhooks short-circuit", () => {
  let server: TestServer;
  let counter: ReturnType<typeof withOpCounter>;
  const tasks = () => createRepository(server.firestore, UID, "tasks");

  const measure = async (label: string, run: () => Promise<unknown>): Promise<OpTally> => {
    counter.reset();
    await run();
    const tally = counter.read();
    console.log(JSON.stringify({ budget: label, ...tally }));
    return tally;
  };

  const notifyWriteCalendar = () => {
    const [channel] = server.google.channelsForCalendar(WRITE_CAL);
    return fetch(`${server.url}/webhooks/gcal`, {
      method: "POST",
      headers: {
        "X-Goog-Channel-Id": channel?.channelId ?? "",
        "X-Goog-Channel-Token": channel?.channelToken ?? "",
        "X-Goog-Resource-State": "exists",
      },
    });
  };

  const settle = async () => {
    for (let pass = 0; pass < 3; pass += 1) await runReconcile(server.reconcileDeps, UID);
  };

  beforeAll(async () => {
    counter = withOpCounter(initAdmin(resolveEmulatorConfig()).firestore);
    server = await bootTestServer({ firestore: counter.firestore });
    await connectCalendar(server, UID, { writeCalendarId: WRITE_CAL, readCalendarIds: [READ_CAL] });
    for (let index = 0; index < TASK_COUNT; index += 1) {
      await upsertTask(server, UID, `t-budget-${index}`, {
        title: `Task ${index}`,
        date: index % 4 === 0 ? null : isoDaysFromToday(1 + (index % 20)),
        time: index % 2 === 0 ? null : "09:00",
      });
    }
    for (let index = 0; index < 5; index += 1) {
      const date = isoDaysFromToday(index + 1);
      server.google.seedEvent(READ_CAL, {
        id: `g-budget-${index}`,
        iCalUID: `ical-budget-${index}`,
        summary: `External ${index}`,
        start: { dateTime: `${date}T13:00:00+00:00` },
        end: { dateTime: `${date}T14:00:00+00:00` },
        status: "confirmed",
      });
    }
    await settle();
  });
  afterAll(async () => {
    await server.close();
  });

  it("an idle scheduled run on a settled account reads a constant handful of docs and writes no data", async () => {
    const tally = await measure("idle-run", () => runReconcile(server.reconcileDeps, UID));
    expect(tally.reads).toBeLessThanOrEqual(IDLE_READ_BUDGET);
    expect(dataWrites(tally)).toBe(0);
    expect(tally.writes).toBeLessThanOrEqual(BOOKKEEPING_WRITE_BUDGET);
  });

  it("one edit reads each collection once to push, and its echo webhook ends with no data writes", async () => {
    const edited = (await tasks().get("t-budget-1")) ?? undefined;
    expect(edited?.time).toBe("09:00");
    await upsertTask(server, UID, "t-budget-1", {
      title: "Task 1",
      date: edited?.date ?? null,
      time: "17:30",
    });

    const push = await measure("push-run", () => runReconcile(server.reconcileDeps, UID));
    const eventId = getGoogleEventId({ ...(edited as NonNullable<typeof edited>) });
    expect(server.google.eventById(WRITE_CAL, eventId)?.start?.dateTime).toContain("17:30");
    for (const label of ["tasks", "calendarEvents", "gcalMirror", "tombstones"])
      expect(push.readsBy[label] ?? 0).toBeLessThanOrEqual(TASK_COUNT);
    expect(push.readsBy.tasks).toBe(TASK_COUNT);
    expect(dataWrites(push)).toBe(1);

    const echo = await measure("echo-webhook", async () => {
      expect((await notifyWriteCalendar()).status).toBe(200);
    });
    expect(echo.reads).toBeLessThanOrEqual(ECHO_READ_BUDGET);
    expect(dataWrites(echo)).toBe(0);
    expect(echo.writes).toBeLessThanOrEqual(BOOKKEEPING_WRITE_BUDGET);
    expect((await tasks().get("t-budget-1"))?.time).toBe("17:30");
  });

  it("an unschedule's delete echo ends with no data writes either", async () => {
    const task = await tasks().get("t-budget-3");
    await upsertTask(server, UID, "t-budget-3", { title: "Task 3", date: null, time: null });
    await runReconcile(server.reconcileDeps, UID);
    const eventId = getGoogleEventId(task as NonNullable<typeof task>);
    expect(server.google.eventById(WRITE_CAL, eventId)?.status).toBe("cancelled");

    const echo = await measure("delete-echo-webhook", async () => {
      expect((await notifyWriteCalendar()).status).toBe(200);
    });
    expect(echo.reads).toBeLessThanOrEqual(ECHO_READ_BUDGET);
    expect(dataWrites(echo)).toBe(0);
  });

  it("a no-op webhook (nothing changed on either side) stays inside the idle budget", async () => {
    const tally = await measure("noop-webhook", async () => {
      expect((await notifyWriteCalendar()).status).toBe(200);
    });
    expect(tally.reads).toBeLessThanOrEqual(IDLE_READ_BUDGET + 1);
    expect(dataWrites(tally)).toBe(0);
    expect(tally.writes).toBeLessThanOrEqual(BOOKKEEPING_WRITE_BUDGET);
  });

  it("a Google-side move behind the gate is still pulled into the task", async () => {
    const task = await tasks().get("t-budget-5");
    const eventId = getGoogleEventId(task as NonNullable<typeof task>);
    const moved = server.google.eventById(WRITE_CAL, eventId);
    const date = task?.date ?? "";
    await server.google.client.patchEvent(WRITE_CAL, eventId, {
      ...moved,
      start: { dateTime: `${date}T11:00:00`, timeZone: "UTC" },
      end: { dateTime: `${date}T11:30:00`, timeZone: "UTC" },
    });

    expect((await notifyWriteCalendar()).status).toBe(200);
    expect((await tasks().get("t-budget-5"))?.time).toBe("11:00");
  });

  it("a push that failed is retried by the next gated run instead of being skipped as settled", async () => {
    const task = await tasks().get("t-budget-7");
    await upsertTask(server, UID, "t-budget-7", {
      title: "Task 7",
      date: task?.date ?? null,
      time: "06:15",
    });
    server.google.failNextPushes(1);
    const failed = await runReconcile(server.reconcileDeps, UID);
    expect(failed.pushFailures).toBe(1);

    expect((await notifyWriteCalendar()).status).toBe(200);
    const eventId = getGoogleEventId(task as NonNullable<typeof task>);
    expect(server.google.eventById(WRITE_CAL, eventId)?.start?.dateTime).toContain("06:15");
  });

  it("a new event on a read calendar behind the gate still lands in the lived mirror", async () => {
    await runReconcile(server.reconcileDeps, UID);
    const date = isoDaysFromToday(4);
    server.google.seedEvent(READ_CAL, {
      id: "g-budget-new",
      iCalUID: "ical-budget-new",
      summary: "Dentist",
      start: { dateTime: `${date}T15:00:00+00:00` },
      end: { dateTime: `${date}T16:00:00+00:00` },
      status: "confirmed",
    });

    expect((await notifyWriteCalendar()).status).toBe(200);
    const rows = await createRepository(server.firestore, UID, "calendarEvents").list();
    expect(rows.find((row) => row.googleId === "g-budget-new")?.title).toBe("Dentist");
  });

  it("a timezone change carries no sync bump but still forces the full pass that re-pushes", async () => {
    await runReconcile(server.reconcileDeps, UID);
    await writeGcalAccount(server.firestore, UID, { timeZone: "America/Toronto" });
    const result = await runReconcile(server.reconcileDeps, UID);
    expect(result.pushed).toBeGreaterThan(0);
  });

  it("a stamp from an earlier UTC day forces the daily full verify pass", async () => {
    await runReconcile(server.reconcileDeps, UID);
    const account = await readGcalAccount(server.firestore, UID);
    const stamp = account?.lastReconcile;
    expect(stamp).toBeTruthy();
    await writeGcalAccount(server.firestore, UID, {
      lastReconcile: { ...(stamp as NonNullable<typeof stamp>), day: "2000-01-01" },
    });

    const tally = await measure("daily-verify", () => runReconcile(server.reconcileDeps, UID));
    expect(tally.readsBy.tasks).toBe(TASK_COUNT);
    const quiet = await measure("after-verify", () => runReconcile(server.reconcileDeps, UID));
    expect(quiet.reads).toBeLessThanOrEqual(IDLE_READ_BUDGET);
  });
});
