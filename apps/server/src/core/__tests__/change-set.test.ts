import type { Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ToolError } from "../../features/mcp/tool-result";
import { bootTestServer, type TestServer } from "../../test/harness";
import {
  type ChangeOperation,
  type ChangeSet,
  commitChangeSet,
  computeChangeDigest,
  ExpectationFailedError,
  formatUpdateTime,
  touchesCalendar,
} from "../change-set";
import { readSyncVersion } from "../sync-version";
import { listTombstones } from "../tombstone";

const NOW = "2026-11-20T15:00:00.000Z";

const buildValue = (id: string, name = id) => ({
  id,
  name,
  icon: "compass",
  hue: "#55554c",
  spectrum: "courage",
  energy: 0.5,
  desc: "",
  order: 0,
  archivedAt: null,
  restingAt: null,
  identity: "",
});

const putNew = (id: string, name = id): ChangeOperation => ({
  kind: "put",
  collection: "values",
  record: buildValue(id, name),
  expect: { absent: true },
});

const toChangeSet = (operations: ChangeOperation[], guards: ChangeSet["guards"] = []) => ({
  operations,
  guards,
});

describe("commitChangeSet (emulator)", () => {
  let server: TestServer;
  let firestore: Firestore;

  const valueRef = (uid: string, id: string) => firestore.doc(`users/${uid}/values/${id}`);

  async function readUpdateTime(uid: string, id: string): Promise<string> {
    const snapshot = await valueRef(uid, id).get();
    if (!snapshot.updateTime) throw new Error(`values/${id} is missing`);
    return formatUpdateTime(snapshot.updateTime);
  }

  beforeAll(async () => {
    server = await bootTestServer();
    firestore = server.firestore;
  });
  afterAll(async () => {
    await server.close();
  });

  it("commits nothing and leaves the counter alone for an empty change set", async () => {
    const uid = "cs-empty";
    const receipt = await commitChangeSet(firestore, uid, toChangeSet([]), NOW);
    expect(receipt).toEqual({ written: 0, removed: 0, syncVersion: null, committedIds: {} });
    expect(await readSyncVersion(firestore, uid)).toBe(0);
  });

  it("creates, stamps field LWW meta and bumps the counter once per chunk", async () => {
    const uid = "cs-create";
    const receipt = await commitChangeSet(
      firestore,
      uid,
      toChangeSet([putNew("v_a"), putNew("v_b")]),
      NOW,
    );
    expect(receipt).toEqual({
      written: 2,
      removed: 0,
      syncVersion: 1,
      committedIds: { values: ["v_a", "v_b"] },
    });
    const stored = (await valueRef(uid, "v_a").get()).data();
    expect(stored).toMatchObject({ name: "v_a", updatedAt: NOW });
    expect(stored?.fieldUpdatedAt.name).toBe(NOW);
    expect(await readSyncVersion(firestore, uid)).toBe(1);
  });

  it("removes with a tombstone, checked against the snapshot's updateTime", async () => {
    const uid = "cs-remove";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_gone")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_gone");
    const receipt = await commitChangeSet(
      firestore,
      uid,
      toChangeSet([{ kind: "remove", collection: "values", id: "v_gone", expect: { updateTime } }]),
      NOW,
    );
    expect(receipt).toMatchObject({ removed: 1, committedIds: { values: ["v_gone"] } });
    expect((await valueRef(uid, "v_gone").get()).exists).toBe(false);
    expect((await listTombstones(firestore, uid)).map((tombstone) => tombstone.id)).toEqual([
      "v_gone",
    ]);
    expect(await readSyncVersion(firestore, uid)).toBe(2);
  });

  it("refuses an absent expectation on an existing doc and writes nothing", async () => {
    const uid = "cs-absent";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_taken", "first")]), NOW);
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet([putNew("v_new"), putNew("v_taken", "second")]),
      NOW,
    );
    await expect(attempt).rejects.toBeInstanceOf(ExpectationFailedError);
    expect((await valueRef(uid, "v_new").get()).exists).toBe(false);
    expect((await valueRef(uid, "v_taken").get()).data()?.name).toBe("first");
    expect(await readSyncVersion(firestore, uid)).toBe(1);
  });

  it("detects a rewrite that kept updatedAt but moved the snapshot's updateTime", async () => {
    const uid = "cs-same-updated-at";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_x", "original")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_x");
    const stored = (await valueRef(uid, "v_x").get()).data();
    await valueRef(uid, "v_x").set({ ...stored, desc: "edited elsewhere", updatedAt: NOW });
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet([
        {
          kind: "put",
          collection: "values",
          record: buildValue("v_x", "mine"),
          expect: { updateTime },
        },
      ]),
      NOW,
    );
    await expect(attempt).rejects.toBeInstanceOf(ExpectationFailedError);
    expect((await valueRef(uid, "v_x").get()).data()?.desc).toBe("edited elsewhere");
  });

  it("rejects a schema failure as BAD_REQUEST with the path before any transaction", async () => {
    const uid = "cs-schema";
    const broken: ChangeOperation = {
      kind: "put",
      collection: "values",
      record: { ...buildValue("v_bad"), energy: "high" },
      expect: { absent: true },
    };
    const attempt = commitChangeSet(firestore, uid, toChangeSet([putNew("v_ok"), broken]), NOW);
    await expect(attempt).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("values.energy:"),
    });
    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    expect((await valueRef(uid, "v_ok").get()).exists).toBe(false);
  });

  it("skips an unchanged put without moving the counter", async () => {
    const uid = "cs-unchanged";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_same")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_same");
    const receipt = await commitChangeSet(
      firestore,
      uid,
      toChangeSet([
        { kind: "put", collection: "values", record: buildValue("v_same"), expect: { updateTime } },
      ]),
      "2026-11-21T00:00:00.000Z",
    );
    expect(receipt).toEqual({ written: 0, removed: 0, syncVersion: null, committedIds: {} });
    expect(await readSyncVersion(firestore, uid)).toBe(1);
  });

  it("keeps the last operation for a repeated id", async () => {
    const uid = "cs-dedupe";
    await commitChangeSet(
      firestore,
      uid,
      toChangeSet([putNew("v_twice", "early"), putNew("v_twice", "late")]),
      NOW,
    );
    expect((await valueRef(uid, "v_twice").get()).data()?.name).toBe("late");
  });

  it("splits past 449 writes into ordered chunks, each bumping the counter", async () => {
    const uid = "cs-chunks";
    const operations = Array.from({ length: 450 }, (_, index) => putNew(`v_${index}`));
    const receipt = await commitChangeSet(firestore, uid, toChangeSet(operations), NOW);
    expect(receipt.written).toBe(450);
    expect(receipt.syncVersion).toBe(2);
    expect(await readSyncVersion(firestore, uid)).toBe(2);
  });

  it("fails a dependent guard when an unexpected child now points at the parent", async () => {
    const uid = "cs-guard";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_parent")]), NOW);
    await firestore
      .doc(`users/${uid}/goals/g_intruder`)
      .set({ id: "g_intruder", valueId: "v_parent" });
    const updateTime = await readUpdateTime(uid, "v_parent");
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet(
        [{ kind: "remove", collection: "values", id: "v_parent", expect: { updateTime } }],
        [{ collection: "goals", field: "valueId", value: "v_parent", expectedIds: [] }],
      ),
      NOW,
    );
    await expect(attempt).rejects.toBeInstanceOf(ExpectationFailedError);
    expect((await valueRef(uid, "v_parent").get()).exists).toBe(true);
  });
});

describe("change-set helpers", () => {
  it("flags a change set that touches tasks or calendar events", () => {
    expect(touchesCalendar(toChangeSet([putNew("v_a")]))).toBe(false);
    expect(
      touchesCalendar(
        toChangeSet([{ kind: "remove", collection: "tasks", id: "t_1", expect: { absent: true } }]),
      ),
    ).toBe(true);
  });

  it("digests the affected set regardless of order or expectations", () => {
    const removeTask: ChangeOperation = {
      kind: "remove",
      collection: "tasks",
      id: "t_1",
      expect: { updateTime: "x" },
    };
    const digest = computeChangeDigest(toChangeSet([putNew("v_a"), removeTask]));
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
    expect(
      computeChangeDigest(
        toChangeSet([{ ...removeTask, expect: { absent: true } }, putNew("v_a")]),
      ),
    ).toBe(digest);
    expect(computeChangeDigest(toChangeSet([putNew("v_a")]))).not.toBe(digest);
  });
});
