import { collectionNameSchema } from "@vega/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../../calendar/reconcile";

function livedEvent(id: string) {
  return {
    id,
    googleId: `g_${id}`,
    iCalUID: `u_${id}`,
    calendarId: "primary",
    title: "Concert",
    date: "2026-07-13",
    endDate: null,
    time: "09:00",
    durationMin: 120,
    allDay: false,
    recurringEventId: null,
    googleUpdated: null,
    status: "confirmed" as const,
    responseStatus: "accepted" as const,
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
  };
}

describe("data router (real server vs emulator)", () => {
  let server: TestServer;
  const owner = "data-owner";
  const stranger = "data-stranger";

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("upserts and lists a calendarEvents record (the mirror with no domain router)", async () => {
    const record = livedEvent("ce_a");
    const persisted = await server.asUid(owner).data.upsert.mutate({
      collection: "calendarEvents",
      record,
    });
    expect(persisted.id).toBe(record.id);
    expect(typeof persisted.updatedAt).toBe("string");

    const listed = await server.asUid(owner).data.list.query({ collection: "calendarEvents" });
    expect(listed.map((r) => r.id)).toContain(record.id);
  });

  it("scopes reads to the owning uid", async () => {
    await server.asUid(owner).data.upsert.mutate({
      collection: "calendarEvents",
      record: livedEvent("ce_scoped"),
    });
    const strangerIds = (
      await server.asUid(stranger).data.list.query({ collection: "calendarEvents" })
    ).map((r) => r.id);
    expect(strangerIds).not.toContain("ce_scoped");
  });

  it("strips an unknown field rather than rejecting", async () => {
    const persisted = await server.asUid(owner).data.upsert.mutate({
      collection: "calendarEvents",
      record: { ...livedEvent("ce_extra"), bogus: 1 },
    });
    expect(persisted.id).toBe("ce_extra");
    expect(persisted).not.toHaveProperty("bogus");
  });

  it("rejects a type-malformed record with BAD_REQUEST", async () => {
    await expect(
      server.asUid(owner).data.upsert.mutate({
        collection: "calendarEvents",
        record: { ...livedEvent("ce_bad"), id: 123 },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
  });

  it("imports many records then wipes every collection with deleteAll", async () => {
    const imported = await server.asUid(owner).data.importCollection.mutate({
      collection: "calendarEvents",
      records: [livedEvent("ce_i1"), livedEvent("ce_i2")],
    });
    expect(imported).toEqual({ inserted: 2, skipped: 0, writtenChunks: 1 });

    await server.asUid(owner).tasks.upsert.mutate({
      id: "t_wipe",
      title: "doomed",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: null,
      date: null,
      time: null,
      durationMin: 30,
      status: "open",
      detached: false,
      note: "",
      order: 0,
    });

    await server.asUid(owner).data.deleteAll.mutate();

    expect(await server.asUid(owner).data.list.query({ collection: "calendarEvents" })).toEqual([]);
    expect(await createRepository(server.firestore, owner, "tasks").get("t_wipe")).toBeNull();
  });

  it("deleteAll tombstones a mirror event so a later reconcile cannot resurrect it", async () => {
    const uid = "data-wipe-reconcile";
    const extCal = "cal-ext-wipe";
    const mirror = () => createRepository(server.firestore, uid, "calendarEvents");
    const eventDate = isoDaysFromToday(2);
    await connectCalendar(server, uid, {
      writeCalendarId: "cal-write-wipe",
      readCalendarIds: [extCal],
    });
    server.google.seedEvent(extCal, {
      id: "g-wipe-1",
      iCalUID: "ical-wipe-1",
      summary: "External",
      start: { dateTime: `${eventDate}T09:00:00+00:00` },
      end: { dateTime: `${eventDate}T09:30:00+00:00` },
      updated: "2026-07-13T08:00:00.000Z",
      status: "confirmed",
    });

    await runReconcile(server.reconcileDeps, uid);
    expect((await mirror().list()).some((event) => event.googleId === "g-wipe-1")).toBe(true);

    await server.asUid(uid).data.deleteAll.mutate();
    expect(await server.asUid(uid).data.list.query({ collection: "calendarEvents" })).toEqual([]);

    await runReconcile(server.reconcileDeps, uid);
    expect((await mirror().list()).some((event) => event.googleId === "g-wipe-1")).toBe(false);
  });

  it("loadAll returns every collection uid-scoped in one response", async () => {
    const loader = "data-loadall";
    await server.asUid(loader).data.upsert.mutate({
      collection: "calendarEvents",
      record: livedEvent("ce_all"),
    });
    await server.asUid(loader).tasks.upsert.mutate({
      id: "t_all",
      title: "keep",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: null,
      date: null,
      time: null,
      durationMin: 30,
      status: "open",
      detached: false,
      note: "",
      order: 0,
    });

    const dataset = await server.asUid(loader).data.loadAll.query();
    expect(Object.keys(dataset).sort()).toEqual([...collectionNameSchema.options].sort());
    expect(dataset.calendarEvents.map((r) => r.id)).toContain("ce_all");
    expect(dataset.tasks.map((r) => r.id)).toContain("t_all");

    const strangerDataset = await server.asUid(stranger).data.loadAll.query();
    expect(strangerDataset.calendarEvents.map((r) => r.id)).not.toContain("ce_all");
    expect(strangerDataset.tasks.map((r) => r.id)).not.toContain("t_all");
  });

  it("removes a record by id", async () => {
    await server.asUid(owner).data.upsert.mutate({
      collection: "calendarEvents",
      record: livedEvent("ce_del"),
    });
    await server.asUid(owner).data.remove.mutate({ collection: "calendarEvents", id: "ce_del" });
    expect(
      await createRepository(server.firestore, owner, "calendarEvents").get("ce_del"),
    ).toBeNull();
  });

  it("rejects an unauthenticated write with UNAUTHORIZED", async () => {
    await expect(
      server.call.data.upsert.mutate({ collection: "calendarEvents", record: livedEvent("ce_x") }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });
});
