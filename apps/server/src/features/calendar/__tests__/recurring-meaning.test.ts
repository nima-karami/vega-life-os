import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-recur";

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

describe("meaning inheritance is scoped to true moves, not recurring siblings", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("does not bleed a tagged instance's meaning onto a new same-series instance", async () => {
    const uid = "u-recur-new";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-rec"],
    });
    server.google.seedEvent("cal-rec", {
      id: "inst-1",
      iCalUID: "series@google.com",
      summary: "Weekly sync",
      start: { date: isoDaysFromNow(1) },
      end: { date: isoDaysFromNow(2) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    const inst1 = (await repo.list()).find((row) => row.googleId === "inst-1");
    if (!inst1) throw new Error("mirror missing");
    await repo.upsert({ ...inst1, valueId: "v-series", note: "tagged" });

    server.google.seedEvent("cal-rec", {
      id: "inst-2",
      iCalUID: "series@google.com",
      summary: "Weekly sync",
      start: { date: isoDaysFromNow(8) },
      end: { date: isoDaysFromNow(9) },
    });
    await runReconcile(server.reconcileDeps, uid);

    const rows = await repo.list();
    const inst2 = rows.find((row) => row.googleId === "inst-2");
    expect(inst2?.valueId).toBeNull();
    expect(inst2?.note).toBe("");
    expect(rows.find((row) => row.googleId === "inst-1")?.valueId).toBe("v-series");
  });

  it("retains a cancelled tagged instance's removedAt when the same-series sibling is a different date", async () => {
    const uid = "u-recur-cancel";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-rec2"],
    });
    server.google.seedEvent("cal-rec2", {
      id: "ri-1",
      iCalUID: "s2@google.com",
      summary: "Standup",
      start: { date: isoDaysFromNow(2) },
      end: { date: isoDaysFromNow(3) },
    });
    server.google.seedEvent("cal-rec2", {
      id: "ri-2",
      iCalUID: "s2@google.com",
      summary: "Standup",
      start: { date: isoDaysFromNow(9) },
      end: { date: isoDaysFromNow(10) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    const ri1 = (await repo.list()).find((row) => row.googleId === "ri-1");
    if (!ri1) throw new Error("mirror missing");
    await repo.upsert({ ...ri1, valueId: "v-s2", note: "keep" });

    server.google.seedEvent("cal-rec2", { id: "ri-1", status: "cancelled" });
    await runReconcile(server.reconcileDeps, uid);

    const rows = await repo.list();
    const cancelled = rows.find((row) => row.googleId === "ri-1");
    expect(cancelled?.removedAt).toBeTruthy();
    expect(cancelled?.valueId).toBe("v-s2");
    expect(rows.find((row) => row.googleId === "ri-2")?.valueId).toBeNull();
  });
});
