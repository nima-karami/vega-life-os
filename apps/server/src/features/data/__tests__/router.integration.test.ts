import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { bootTestServer, type TestServer } from "../../../test/harness";

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

  it("rejects a malformed record with BAD_REQUEST", async () => {
    await expect(
      server.asUid(owner).data.upsert.mutate({
        collection: "calendarEvents",
        record: { ...livedEvent("ce_bad"), bogus: 1 },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
  });

  it("imports many records then wipes every collection with deleteAll", async () => {
    const { count } = await server.asUid(owner).data.importCollection.mutate({
      collection: "calendarEvents",
      records: [livedEvent("ce_i1"), livedEvent("ce_i2")],
    });
    expect(count).toBe(2);

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
