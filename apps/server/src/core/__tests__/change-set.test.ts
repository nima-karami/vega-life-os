import type { Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withFailingTransaction } from "../../test/failing-transaction";
import { bootTestServer, type TestServer } from "../../test/harness";
import {
  type ChangeOperation,
  type ChangeSet,
  commitChangeSet,
  computeChangeDigest,
  ExpectationFailedError,
  formatUpdateTime,
  touchesCalendar,
  type WriteOperation,
} from "../change-set";
import { estimateDocumentBytes, packChunks } from "../change-set-chunks";
import { readSyncVersion } from "../sync-version";
import { listTombstones } from "../tombstone";
import { ToolError } from "../tool-error";

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
    expect(receipt).toEqual({
      written: 0,
      removed: 0,
      syncVersion: null,
      committedIds: {},
      records: {},
    });
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
      records: {},
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
      message: expect.stringContaining("values/v_bad.energy:"),
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
      "values/v_same",
    );
    expect(receipt).toMatchObject({ written: 0, removed: 0, syncVersion: null, committedIds: {} });
    expect(receipt.records["values/v_same"]).toEqual({ ...buildValue("v_same"), updatedAt: NOW });
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

  it("verifies a check against its parent's snapshot without writing it", async () => {
    const uid = "cs-check";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_parent")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_parent");
    const check: ChangeOperation = {
      kind: "check",
      collection: "values",
      id: "v_parent",
      expect: { updateTime },
    };
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_child"), check]), NOW);
    expect(await readSyncVersion(firestore, uid)).toBe(2);
    await valueRef(uid, "v_parent").update({ desc: "changed" });
    const stale = commitChangeSet(firestore, uid, toChangeSet([putNew("v_late"), check]), NOW);
    await expect(stale).rejects.toBeInstanceOf(ExpectationFailedError);
    expect((await valueRef(uid, "v_late").get()).exists).toBe(false);
  });

  it("splits on the byte budget well below the write limit, and refuses one oversized record", async () => {
    const uid = "cs-bytes";
    const book = (
      id: string,
      noteLength: number,
      note = "n".repeat(noteLength),
    ): ChangeOperation => ({
      kind: "put",
      collection: "books",
      record: {
        id,
        title: id,
        author: "a",
        status: "queued",
        rating: null,
        pages: null,
        currentPage: null,
        startedAt: null,
        finishedAt: null,
        valueId: null,
        note,
        order: 0,
      },
      expect: { absent: true },
    });
    const bulky = Array.from({ length: 40 }, (_, index) => book(`b_${index}`, 300_000));
    const receipt = await commitChangeSet(firestore, uid, toChangeSet(bulky), NOW);
    expect(receipt.written).toBe(40);
    expect(receipt.syncVersion).toBe(2);
    const oversized = commitChangeSet(
      firestore,
      uid,
      toChangeSet([book("b_huge", 5_000_000)]),
      NOW,
    );
    await expect(oversized).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("too large"),
    });
    expect(await readSyncVersion(firestore, uid)).toBe(2);

    const nearLimit = [book("b_long", 900 * 1024), book("b_quotes", 0, '"'.repeat(470_000))];
    const accepted = await commitChangeSet(firestore, uid, toChangeSet(nearLimit), NOW);
    expect(accepted.written).toBe(2);
  });

  it("refuses an id that isn't a single document segment", async () => {
    const attempt = commitChangeSet(
      firestore,
      "cs-segment",
      toChangeSet([putNew("v_a/nested")]),
      NOW,
    );
    await expect(attempt).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("evaluates a logical-key guard on a change set with no removal", async () => {
    const uid = "cs-logical-key";
    await firestore.doc(`users/${uid}/goals/g_holder`).set({ id: "g_holder", valueId: "v_key" });
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet(
        [putNew("v_key")],
        [{ collection: "goals", field: "valueId", value: "v_key", expectedIds: ["g_other"] }],
      ),
      NOW,
    );
    await expect(attempt).rejects.toBeInstanceOf(ExpectationFailedError);
    expect((await valueRef(uid, "v_key").get()).exists).toBe(false);
  });

  async function seedLargeValues(uid: string, count: number, stampBytes: number) {
    const stamps = Object.fromEntries(
      Array.from({ length: Math.ceil(stampBytes / 1000) }, (_, index) => [
        `legacy_${index}`,
        "s".repeat(980),
      ]),
    );
    for (let index = 0; index < count; index += 1)
      await valueRef(uid, `v_big_${index}`).set({
        ...buildValue(`v_big_${index}`),
        updatedAt: NOW,
        fieldUpdatedAt: stamps,
      });
    return Promise.all(
      Array.from({ length: count }, async (_, index) => ({
        id: `v_big_${index}`,
        updateTime: await readUpdateTime(uid, `v_big_${index}`),
        storedBytes: Buffer.byteLength(
          JSON.stringify((await valueRef(uid, `v_big_${index}`).get()).data()),
        ),
      })),
    );
  }

  it("budgets an update by the stamp map it retains, splitting small edits of big docs", async () => {
    const uid = "cs-retained-stamps";
    const seeded = await seedLargeValues(uid, 20, 300_000);
    const operations: ChangeOperation[] = seeded.map(({ id, updateTime, storedBytes }) => ({
      kind: "put",
      collection: "values",
      record: buildValue(id, `${id} renamed`),
      expect: { updateTime },
      storedBytes,
    }));
    const receipt = await commitChangeSet(firestore, uid, toChangeSet(operations), NOW);
    expect(receipt.written).toBe(20);
    expect(receipt.syncVersion).toBe(2);
  });

  it("budgets a removal by the doc it deletes", async () => {
    const uid = "cs-large-delete";
    const seeded = await seedLargeValues(uid, 20, 300_000);
    const operations: ChangeOperation[] = seeded.map(({ id, updateTime, storedBytes }) => ({
      kind: "remove",
      collection: "values",
      id,
      expect: { updateTime },
      storedBytes,
    }));
    const receipt = await commitChangeSet(firestore, uid, toChangeSet(operations), NOW);
    expect(receipt.removed).toBe(20);
    expect(receipt.syncVersion).toBeGreaterThanOrEqual(2);
  });

  it("refuses a check and a write that expect the same doc at different versions", async () => {
    const uid = "cs-contradiction";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_doc")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_doc");
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet([
        {
          kind: "put",
          collection: "values",
          record: buildValue("v_doc", "x"),
          expect: { updateTime },
        },
        {
          kind: "check",
          collection: "values",
          id: "v_doc",
          expect: { updateTime: "2020-01-01T00:00:00.000000000Z" },
        },
      ]),
      NOW,
    );
    await expect(attempt).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await valueRef(uid, "v_doc").get()).data()?.name).toBe("v_doc");
  });

  it("writes a checked parent last, so a replacement between chunks stops it", async () => {
    const uid = "cs-parent-between-chunks";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_parent")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_parent");
    const withParent = (expectTime: string): ChangeOperation[] => [
      {
        kind: "put",
        collection: "values",
        record: buildValue("v_parent", "edited"),
        expect: { updateTime: expectTime },
      },
      ...Array.from({ length: 450 }, (_, index) => putNew(`v_child_${index}`)),
      { kind: "check", collection: "values", id: "v_parent", expect: { updateTime: expectTime } },
    ];
    const clean = await commitChangeSet(firestore, uid, toChangeSet(withParent(updateTime)), NOW);
    expect(clean.written).toBe(451);
    expect((await valueRef(uid, "v_parent").get()).get("name")).toBe("edited");

    const raced = "cs-parent-replaced";
    await commitChangeSet(firestore, raced, toChangeSet([putNew("v_parent")]), NOW);
    const racedTime = await readUpdateTime(raced, "v_parent");
    const faults = withFailingTransaction(firestore);
    faults.beforeTransaction(2, async () => {
      const original = (await valueRef(raced, "v_parent").get()).data() ?? {};
      await valueRef(raced, "v_parent").delete();
      await valueRef(raced, "v_parent").set(original);
    });
    const attempt = commitChangeSet(
      faults.firestore,
      raced,
      toChangeSet(withParent(racedTime)),
      NOW,
    );
    await expect(attempt).rejects.toMatchObject({
      code: "INTERNAL",
      detail: { failedAtOperation: 450 },
    });
    expect((await valueRef(raced, "v_child_448").get()).exists).toBe(true);
    expect((await valueRef(raced, "v_child_449").get()).exists).toBe(false);
    expect((await valueRef(raced, "v_parent").get()).get("name")).toBe("v_parent");
  });

  it.each([
    "values/v_typo",
    "",
  ])("refuses a claimed guard (%j) that no write in the set claims, before writing", async (claimedBy) => {
    const uid = `cs-unclaimed-guard-${claimedBy.length}`;
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet(
        [putNew("v_one")],
        [{ collection: "goals", field: "valueId", value: "v_one", expectedIds: [], claimedBy }],
      ),
      NOW,
    );
    await expect(attempt).rejects.toMatchObject({ code: "INTERNAL" });
    expect((await valueRef(uid, "v_one").get()).exists).toBe(false);
    expect(await readSyncVersion(firestore, uid)).toBe(0);
  });

  it("refuses more checked writes than one chunk holds, before writing", async () => {
    const uid = "cs-checked-overflow";
    const seeded = Array.from({ length: 450 }, (_, index) => putNew(`v_c_${index}`));
    await commitChangeSet(firestore, uid, toChangeSet(seeded), NOW);
    const before = await readSyncVersion(firestore, uid);
    const operations: ChangeOperation[] = [];
    for (let index = 0; index < 450; index += 1) {
      const id = `v_c_${index}`;
      const updateTime = await readUpdateTime(uid, id);
      operations.push(
        {
          kind: "put",
          collection: "values",
          record: buildValue(id, "renamed"),
          expect: { updateTime },
        },
        { kind: "check", collection: "values", id, expect: { updateTime } },
      );
    }
    const attempt = commitChangeSet(firestore, uid, toChangeSet(operations), NOW);
    await expect(attempt).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await valueRef(uid, "v_c_0").get()).get("name")).toBe("v_c_0");
    expect(await readSyncVersion(firestore, uid)).toBe(before);
  });

  it("verifies a check-only change set in a read-only transaction", async () => {
    const uid = "cs-check-only";
    await commitChangeSet(firestore, uid, toChangeSet([putNew("v_only")]), NOW);
    const updateTime = await readUpdateTime(uid, "v_only");
    const valid = await commitChangeSet(
      firestore,
      uid,
      toChangeSet([{ kind: "check", collection: "values", id: "v_only", expect: { updateTime } }]),
      NOW,
    );
    expect(valid).toMatchObject({ written: 0, syncVersion: null });
    expect(await readSyncVersion(firestore, uid)).toBe(1);
    const stale = commitChangeSet(
      firestore,
      uid,
      toChangeSet([
        { kind: "check", collection: "values", id: "v_only", expect: { absent: true } },
      ]),
      NOW,
    );
    await expect(stale).rejects.toBeInstanceOf(ExpectationFailedError);
  });

  it("runs a claimed key guard with its claiming write in the first chunk", async () => {
    const uid = "cs-first-chunk-claim";
    await firestore.doc(`users/${uid}/goals/g_holder`).set({ id: "g_holder", valueId: "v_claim" });
    const attempt = commitChangeSet(
      firestore,
      uid,
      toChangeSet(
        [
          putNew("v_claim"),
          ...Array.from({ length: 450 }, (_, index) => putNew(`v_rest_${index}`)),
        ],
        [
          {
            collection: "goals",
            field: "valueId",
            value: "v_claim",
            expectedIds: [],
            claimedBy: "values/v_claim",
          },
        ],
      ),
      NOW,
    );
    await expect(attempt).rejects.toBeInstanceOf(ExpectationFailedError);
    expect((await valueRef(uid, "v_claim").get()).exists).toBe(false);
    expect(await readSyncVersion(firestore, uid)).toBe(0);
  });

  it("captures only the primary row in the receipt", async () => {
    const uid = "cs-primary";
    const receipt = await commitChangeSet(
      firestore,
      uid,
      toChangeSet([putNew("v_main"), putNew("v_side_a"), putNew("v_side_b")]),
      NOW,
      "values/v_main",
    );
    expect(Object.keys(receipt.records)).toEqual(["values/v_main"]);
  });
});

describe("change-set helpers", () => {
  it("counts index entries, so many short array elements weigh more than their JSON", () => {
    const tags = Array.from({ length: 5_000 }, (_, index) => String(index % 10));
    const jsonBytes = Buffer.byteLength(JSON.stringify({ id: "b_1", tags }));
    const docPath = "users/u/books/b_1";
    const estimate = estimateDocumentBytes({ id: "b_1", tags }, docPath);
    expect(estimate).toBeGreaterThan(jsonBytes + 2 * 5_000 * Buffer.byteLength(docPath));
  });

  it("splits docs heavy in index entries below the write limit", () => {
    const tags = Array.from({ length: 20_000 }, () => "x");
    const operations: WriteOperation[] = Array.from({ length: 40 }, (_, index) => ({
      kind: "put",
      collection: "books",
      record: { id: `b_${index}`, tags },
      expect: { absent: true },
    }));
    const chunks = packChunks("u", operations, new Set(), (operation) =>
      operations.indexOf(operation),
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1].firstIndex).toBe(chunks[0].operations.length);
  });

  it("charges a long uid twice per index entry", () => {
    const uid = "u".repeat(128);
    const operations: WriteOperation[] = Array.from({ length: 2 }, (_, index) => ({
      kind: "put",
      collection: "books",
      record: { id: `b_${index}`, tags: Array.from({ length: 15_000 }, (_, tag) => `t${tag}`) },
      expect: { absent: true },
    }));
    expect(
      packChunks(uid, operations, new Set(), (operation) => operations.indexOf(operation)),
    ).toHaveLength(2);
  });

  it("caps an indexed value at Firestore's 1,500 bytes, keeping two big text edits together", () => {
    const body = "x".repeat(900 * 1024);
    const operations: WriteOperation[] = ["n_a", "n_b"].map((id) => ({
      kind: "put",
      collection: "journal",
      record: { id, journal: body },
      expect: { updateTime: "t" },
      storedBytes: estimateDocumentBytes({ id, journal: body }, `users/u/journal/${id}`),
    }));
    const checked = new Set(["journal/n_a", "journal/n_b"]);
    expect(
      packChunks("u", operations, checked, (operation) => operations.indexOf(operation)),
    ).toHaveLength(1);
  });

  it("commits a small change with a checked write in one chunk", () => {
    const operations: WriteOperation[] = [
      { kind: "put", collection: "tasks", record: { id: "t_1" }, expect: { absent: true } },
      { kind: "put", collection: "habits", record: { id: "h_1" }, expect: { updateTime: "t" } },
    ];
    const chunks = packChunks("u", operations, new Set(["habits/h_1"]), (operation) =>
      operations.indexOf(operation),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].operations.map((operation) => operation.collection)).toEqual([
      "tasks",
      "habits",
    ]);
  });

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
