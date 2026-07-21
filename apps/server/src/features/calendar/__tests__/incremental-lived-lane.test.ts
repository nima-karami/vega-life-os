import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";
import { readGcalAccount } from "../token-store";

const WRITE_CAL = "cal-write-lived-incr";

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

describe("incremental lived lane", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("stores per-calendar sync tokens and applies deltas", async () => {
    const uid = "u-lived-token";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-r1"],
    });
    server.google.seedEvent("cal-r1", {
      id: "g1",
      iCalUID: "g1@google.com",
      summary: "Standup",
      start: { date: isoDaysFromNow(1) },
      end: { date: isoDaysFromNow(2) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.syncTokens?.["cal-r1"]).toBeTruthy();

    server.google.seedEvent("cal-r1", {
      id: "g2",
      iCalUID: "g2@google.com",
      summary: "Review",
      start: { date: isoDaysFromNow(2) },
      end: { date: isoDaysFromNow(3) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const rows = await createRepository(server.firestore, uid, "calendarEvents").list();
    expect(rows.map((row) => row.googleId).sort()).toEqual(["g1", "g2"]);
  });

  it("skips delta inserts outside the lived window but keeps updates to known mirrors", async () => {
    const uid = "u-lived-window";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-r2"],
    });
    await runReconcile(server.reconcileDeps, uid);
    server.google.seedEvent("cal-r2", {
      id: "g-far",
      iCalUID: "g-far@google.com",
      summary: "Next year",
      start: { date: isoDaysFromNow(400) },
      end: { date: isoDaysFromNow(401) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const rows = await createRepository(server.firestore, uid, "calendarEvents").list();
    expect(rows.find((row) => row.googleId === "g-far")).toBeUndefined();
  });

  it("auto-deselects a vanished read calendar and retains meaning-tagged mirrors with removedAt", async () => {
    const uid = "u-lived-vanish";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-gone", "cal-stays"],
    });
    server.google.seedEvent("cal-gone", {
      id: "g-meaning",
      iCalUID: "gm@google.com",
      summary: "Tagged",
      start: { date: isoDaysFromNow(3) },
      end: { date: isoDaysFromNow(4) },
    });
    server.google.seedEvent("cal-gone", {
      id: "g-plain",
      iCalUID: "gp@google.com",
      summary: "Plain",
      start: { date: isoDaysFromNow(3) },
      end: { date: isoDaysFromNow(4) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    const tagged = (await repo.list()).find((row) => row.googleId === "g-meaning");
    if (!tagged) throw new Error("mirror missing");
    await repo.upsert({ ...tagged, valueId: "v1" });
    const before = await readGcalAccount(server.firestore, uid);
    expect(before?.syncTokens?.["cal-gone"]).toBeTruthy();

    server.google.failNextList(404);
    await runReconcile(server.reconcileDeps, uid);

    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.readCalendarIds).toEqual(["cal-stays"]);
    expect(account?.syncTokens?.["cal-gone"]).toBeUndefined();
    const rows = await repo.list();
    expect(rows.find((row) => row.googleId === "g-plain")).toBeUndefined();
    expect(rows.find((row) => row.googleId === "g-meaning")?.removedAt).toBeTruthy();
  });

  it("migrates meaning by iCalUID when an event moves between calendars", async () => {
    const uid = "u-lived-move";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: ["cal-m1", "cal-m2"],
    });
    server.google.seedEvent("cal-m1", {
      id: "g-src",
      iCalUID: "move@google.com",
      summary: "Movable",
      start: { date: isoDaysFromNow(5) },
      end: { date: isoDaysFromNow(6) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    const source = (await repo.list()).find((row) => row.googleId === "g-src");
    if (!source) throw new Error("mirror missing");
    await repo.upsert({ ...source, valueId: "v-move", note: "keep me" });

    server.google.seedEvent("cal-m1", { id: "g-src", status: "cancelled" });
    server.google.seedEvent("cal-m2", {
      id: "g-dst",
      iCalUID: "move@google.com",
      summary: "Movable",
      start: { date: isoDaysFromNow(5) },
      end: { date: isoDaysFromNow(6) },
    });
    await runReconcile(server.reconcileDeps, uid);

    const rows = await repo.list();
    const moved = rows.find((row) => row.googleId === "g-dst");
    expect(moved?.valueId).toBe("v-move");
    expect(moved?.note).toBe("keep me");
    expect(rows.filter((row) => row.iCalUID === "move@google.com")).toHaveLength(1);
  });

  it("migrates meaning by iCalUID even when the destination calendar is read first", async () => {
    const uid = "u-lived-move-rev";
    const sourceCal = "cal-mv-src";
    const destCal = "cal-mv-dst";
    await connectCalendar(server, uid, {
      writeCalendarId: WRITE_CAL,
      readCalendarIds: [destCal, sourceCal],
    });
    server.google.seedEvent(sourceCal, {
      id: "g-src2",
      iCalUID: "move2@google.com",
      summary: "Movable2",
      start: { date: isoDaysFromNow(5) },
      end: { date: isoDaysFromNow(6) },
    });
    await runReconcile(server.reconcileDeps, uid);
    const repo = createRepository(server.firestore, uid, "calendarEvents");
    const source = (await repo.list()).find((row) => row.googleId === "g-src2");
    if (!source) throw new Error("mirror missing");
    await repo.upsert({ ...source, valueId: "v-move2", note: "hold" });

    server.google.seedEvent(sourceCal, { id: "g-src2", status: "cancelled" });
    server.google.seedEvent(destCal, {
      id: "g-dst2",
      iCalUID: "move2@google.com",
      summary: "Movable2",
      start: { date: isoDaysFromNow(5) },
      end: { date: isoDaysFromNow(6) },
    });
    await runReconcile(server.reconcileDeps, uid);

    const withUid = (await repo.list()).filter((row) => row.iCalUID === "move2@google.com");
    expect(withUid).toHaveLength(1);
    expect(withUid[0]?.valueId).toBe("v-move2");
    expect(withUid[0]?.note).toBe("hold");
  });
});
