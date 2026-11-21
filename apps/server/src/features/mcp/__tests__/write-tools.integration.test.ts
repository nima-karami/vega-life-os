import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AccessTokenScope } from "@vega/shared";
import { buildTask } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readSyncVersion } from "../../../core/sync-version";
import { listTombstones } from "../../../core/tombstone";
import { withFailingTransaction } from "../../../test/failing-transaction";
import { bootTestServer, type TestServer } from "../../../test/harness";
import type { McpContext, ToolRegistrar } from "../mcp-context";
import { buildMcpServer } from "../mcp-server";
import { registerWriteTools } from "../write-tools";
import { computeZonedClock } from "../zoned-clock";

// 22:30 on Friday 2026-11-20 in Toronto; the Tokyo test host is already on Saturday.
const EVENING_IN_TORONTO = Date.parse("2026-11-21T03:30:00Z");
const MON_WED_FRI = {
  type: "weekly",
  days: [1, 0, 1, 0, 1, 0, 0],
  interval: 1,
  anchor: "2026-11-02",
};
const ROW_STAMPS = { updatedAt: "2026-11-01T00:00:00.000Z", fieldUpdatedAt: {} };

// Every grant has some tool in production; the probe stands in for the read tools another lane owns.
const registerProbeTool: ToolRegistrar = (server) => {
  server.registerTool("probe", { description: "test probe" }, () => ({ content: [] }));
};

type ToolOutcome = { isError: boolean; payload: Record<string, unknown>; text: string };

describe("MCP write tools (SDK client over the emulator)", () => {
  let server: TestServer;
  let faults: ReturnType<typeof withFailingTransaction>;
  let firestore: Firestore;
  let nowMs = EVENING_IN_TORONTO;
  let reconciles: string[] = [];
  const clients: Client[] = [];

  async function connect(uid: string, scope: AccessTokenScope = "write"): Promise<Client> {
    const context: McpContext = {
      grant: { uid, tokenId: "pat_test", scope, timeZone: "America/Toronto" },
      firestore: faults.firestore,
      calendar: { scheduleReconcile: (reconciledUid) => reconciles.push(reconciledUid) },
      clock: () => computeZonedClock("America/Toronto", nowMs),
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await buildMcpServer(context, [registerProbeTool, registerWriteTools]).connect(serverTransport);
    const client = new Client({ name: "write-tools-test", version: "1" });
    await client.connect(clientTransport);
    clients.push(client);
    return client;
  }

  async function callTool(
    client: Client,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutcome> {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return {
      isError: result.isError === true,
      payload: (result.structuredContent ?? {}) as Record<string, unknown>,
      text: content[0]?.text ?? "",
    };
  }

  const readDoc = async (uid: string, path: string) =>
    (await firestore.doc(`users/${uid}/${path}`).get()).data();

  const listTasks = async (uid: string) =>
    (await firestore.collection(`users/${uid}/tasks`).get()).docs.map((doc) => doc.data());

  async function seedRows(uid: string, collection: string, rows: { id: string }[]) {
    for (let start = 0; start < rows.length; start += 400) {
      const batch = firestore.batch();
      for (const row of rows.slice(start, start + 400))
        batch.set(firestore.doc(`users/${uid}/${collection}/${row.id}`), { ...row, ...ROW_STAMPS });
      await batch.commit();
    }
  }

  async function seedValueAndHabit(client: Client) {
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_body",
      record: { name: "Body" },
    });
    return callTool(client, "create_record", {
      collection: "habits",
      id: "h_run",
      record: { name: "Run", valueId: "v_body", time: "07:00", schedule: MON_WED_FRI },
    });
  }

  async function previewDigest(
    client: Client,
    args: Record<string, unknown>,
  ): Promise<ToolOutcome & { digest: string }> {
    const outcome = await callTool(client, "delete_record", args);
    return { ...outcome, digest: String(outcome.payload.confirmCascade) };
  }

  beforeAll(async () => {
    server = await bootTestServer();
    firestore = server.firestore;
    faults = withFailingTransaction(firestore);
  });
  beforeEach(() => {
    nowMs = EVENING_IN_TORONTO;
    reconciles = [];
    faults.reset();
  });
  afterAll(async () => {
    await Promise.all(clients.map((client) => client.close()));
    await server.close();
  });

  it("lists the write tools only for a write token, with destructive hints where data goes", async () => {
    const writer = await connect("wt-list");
    const reader = await connect("wt-list", "read");
    const { tools } = await writer.listTools();
    const hints = Object.fromEntries(
      tools
        .filter((tool) => tool.name !== "probe")
        .map((tool) => [tool.name, tool.annotations?.destructiveHint]),
    );
    expect(hints).toEqual({
      create_record: false,
      update_record: true,
      delete_record: true,
      set_task_status: false,
      check_in_habit: false,
      set_habit_state: true,
      edit_subgoals: false,
      write_journal: true,
    });
    expect((await reader.listTools()).tools.map((tool) => tool.name)).toEqual(["probe"]);
    const refused = await callTool(reader, "create_record", {
      collection: "books",
      record: { title: "x" },
    });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/not found/i);
    expect(await firestore.collection("users/wt-list/books").get()).toHaveProperty("size", 0);
  });

  it("AC4: set_task_status(done) stamps the token zone's time, bumps the counter and reconciles", async () => {
    const uid = "wt-ac4";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "tasks",
      id: "t_call",
      record: { title: "Call", date: "2026-11-20" },
    });
    const before = await readSyncVersion(firestore, uid);
    reconciles = [];
    const done = await callTool(client, "set_task_status", { id: "t_call", status: "done" });
    expect(done.payload).toMatchObject({
      record: { status: "done", completedAt: "2026-11-20T22:30:00" },
      syncVersion: before + 1,
    });
    expect(await readSyncVersion(firestore, uid)).toBe(before + 1);
    expect(reconciles).toEqual([uid]);
    const replay = await callTool(client, "set_task_status", { id: "t_call", status: "done" });
    expect(replay.payload).toMatchObject({ writtenCount: 0, syncVersion: null });
  });

  it("AC5: a new Mon/Wed/Fri habit gets exactly its slots from today through today+14", async () => {
    const uid = "wt-ac5";
    const created = await seedValueAndHabit(await connect(uid));
    expect(created.isError).toBe(false);
    const dates = (await listTasks(uid)).map((task) => task.date).sort();
    expect(dates).toEqual([
      "2026-11-20",
      "2026-11-23",
      "2026-11-25",
      "2026-11-27",
      "2026-11-30",
      "2026-12-02",
      "2026-12-04",
    ]);
    expect(reconciles).toEqual([uid]);
  });

  it("AC6 + AC16: a value delete previews its cascade, refuses a stale digest, then deletes it all", async () => {
    const uid = "wt-ac6";
    const client = await connect(uid);
    await seedValueAndHabit(client);
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_fit",
      record: { name: "Fit", valueId: "v_body" },
    });
    const taskCount = (await listTasks(uid)).length;
    const versionBefore = await readSyncVersion(firestore, uid);

    const preview = await previewDigest(client, { collection: "values", id: "v_body" });
    expect(preview.payload).toMatchObject({
      code: "CONFIRM_REQUIRED",
      affected: { removed: { habits: ["h_run"], goals: ["g_fit"], values: ["v_body"] } },
    });
    const stale = await previewDigest(client, {
      collection: "values",
      id: "v_body",
      confirmCascade: "0000000000000000",
    });
    expect(stale.payload).toMatchObject({
      code: "CONFIRM_REQUIRED",
      confirmCascade: preview.digest,
    });
    expect(await readSyncVersion(firestore, uid)).toBe(versionBefore);

    const confirmed = await callTool(client, "delete_record", {
      collection: "values",
      id: "v_body",
      confirmCascade: preview.digest,
    });
    expect(confirmed.isError).toBe(false);
    expect((confirmed.payload.removed as Record<string, string[]>).tasks).toHaveLength(taskCount);
    expect(await listTasks(uid)).toEqual([]);
    expect(await readDoc(uid, "values/v_body")).toBeUndefined();
    expect((await listTombstones(firestore, uid)).length).toBe(taskCount + 3);
    expect(await readSyncVersion(firestore, uid)).toBe(versionBefore + 1);
  });

  it("AC7: a goal delete nulls goalId on its habits and tasks", async () => {
    const uid = "wt-ac7";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_work",
      record: { name: "Work" },
    });
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_ship",
      record: { name: "Ship", valueId: "v_work" },
    });
    await callTool(client, "create_record", {
      collection: "tasks",
      id: "t_linked",
      record: { title: "Draft", goalId: "g_ship" },
    });
    const preview = await previewDigest(client, { collection: "goals", id: "g_ship" });
    const confirmed = await callTool(client, "delete_record", {
      collection: "goals",
      id: "g_ship",
      confirmCascade: preview.digest,
    });
    expect(confirmed.payload).toMatchObject({
      detached: { tasks: ["t_linked"] },
      removed: { goals: ["g_ship"] },
    });
    expect(await readDoc(uid, "tasks/t_linked")).toMatchObject({ goalId: null });
  });

  it("AC8: a schema failure returns BAD_REQUEST with paths and writes nothing", async () => {
    const uid = "wt-ac8";
    const client = await connect(uid);
    const wrongType = await callTool(client, "create_record", {
      collection: "books",
      record: { title: "Dune", pages: "many" },
    });
    expect(wrongType.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("books.pages"),
    });
    const incomplete = await callTool(client, "create_record", {
      collection: "books",
      record: { title: "Dune" },
    });
    expect(incomplete.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("books.author"),
    });
    expect(await readSyncVersion(firestore, uid)).toBe(0);
  });

  it("AC12: a task edit keeps the slot lock; a habit schedule change rebuilds its future instances", async () => {
    const uid = "wt-ac12";
    const client = await connect(uid);
    await seedValueAndHabit(client);
    const monday = (await listTasks(uid)).find((task) => task.date === "2026-11-23");
    const moved = await callTool(client, "update_record", {
      collection: "tasks",
      id: monday?.id,
      patch: { date: "2026-11-24" },
    });
    expect(moved.payload).toMatchObject({ record: { date: "2026-11-24", slotDate: "2026-11-23" } });
    const mixed = await callTool(client, "update_record", {
      collection: "tasks",
      id: monday?.id,
      patch: { status: "done", note: "x" },
    });
    expect(mixed.payload).toMatchObject({ code: "BAD_REQUEST" });

    await callTool(client, "update_record", {
      collection: "habits",
      id: "h_run",
      patch: { schedule: { ...MON_WED_FRI, days: [0, 0, 0, 0, 0, 1, 0] } },
    });
    const todoDates = (await listTasks(uid))
      .filter((task) => task.status === "todo")
      .map((task) => task.date)
      .sort();
    expect(todoDates).toEqual(["2026-11-21", "2026-11-28"]);
  });

  it("AC13: edit_subgoals recomputes progress", async () => {
    const uid = "wt-ac13";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_mind",
      record: { name: "Mind" },
    });
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_read",
      record: { name: "Read", valueId: "v_mind" },
    });
    const added = await callTool(client, "edit_subgoals", {
      goalId: "g_read",
      add: ["a", "b", "c", "d"],
    });
    const ids = (added.payload.record as { subgoals: { id: string }[] }).subgoals.map(
      (subgoal) => subgoal.id,
    );
    await callTool(client, "edit_subgoals", { goalId: "g_read", toggle: ids.slice(0, 2) });
    expect(await readDoc(uid, "goals/g_read")).toMatchObject({ progress: 0.5 });
  });

  it("AC14: write_journal updates one record per date and deletes an emptied entry", async () => {
    const uid = "wt-ac14";
    const client = await connect(uid);
    await callTool(client, "write_journal", { journal: "first" });
    await callTool(client, "write_journal", { appendJournal: "second" });
    const journals = (await firestore.collection(`users/${uid}/journal`).get()).docs.map((doc) =>
      doc.data(),
    );
    expect(journals).toEqual([
      expect.objectContaining({ id: "day_2026-11-20", journal: "first\nsecond" }),
    ]);
    const emptied = await callTool(client, "write_journal", { journal: "" });
    expect(emptied.payload).toMatchObject({ removed: { journal: ["day_2026-11-20"] } });
    expect(await readDoc(uid, "journal/day_2026-11-20")).toBeUndefined();
  });

  it("AC15: creating a review for a held period updates that review", async () => {
    const uid = "wt-ac15";
    const client = await connect(uid);
    await seedRows(uid, "reviews", [
      {
        id: "rv_app",
        periodKey: "2026-W47",
        prompts: [],
        checkIns: [],
        createdAt: "2026-11-16T00:00:00.000Z",
      } as { id: string },
    ]);
    const outcome = await callTool(client, "create_record", {
      collection: "reviews",
      record: { periodKey: "2026-W47", prompts: [{ q: "win", a: "shipped" }] },
    });
    expect(outcome.payload).toMatchObject({ record: { id: "rv_app" } });
    expect((await firestore.collection(`users/${uid}/reviews`).get()).size).toBe(1);
  });

  it("AC17: check_in_habit refuses to create an ineligible instance and writes nothing", async () => {
    const uid = "wt-ac17";
    const client = await connect(uid);
    await seedValueAndHabit(client);
    const today = await callTool(client, "check_in_habit", { habitId: "h_run" });
    expect(today.payload).toMatchObject({
      created: false,
      record: { status: "done", date: "2026-11-20" },
    });
    const before = await readSyncVersion(firestore, uid);
    const offSchedule = await callTool(client, "check_in_habit", {
      habitId: "h_run",
      date: "2026-11-21",
    });
    expect(offSchedule.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("scheduled"),
    });
    await callTool(client, "set_habit_state", { id: "h_run", state: "pause" });
    const paused = await callTool(client, "check_in_habit", {
      habitId: "h_run",
      date: "2026-11-23",
    });
    expect(paused.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("paused"),
    });
    expect(await readSyncVersion(firestore, uid)).toBe(before + 1);
  });

  it("AC18: read-only and retired collections refuse writes", async () => {
    const client = await connect("wt-ac18");
    const calendar = await callTool(client, "create_record", {
      collection: "calendarEvents",
      record: {},
    });
    expect(calendar.payload).toMatchObject({ code: "BAD_REQUEST" });
    const batches = await callTool(client, "delete_record", {
      collection: "financeImportBatches",
      id: "x",
    });
    expect(batches.payload).toMatchObject({ code: "BAD_REQUEST" });
    const retired = await callTool(client, "create_record", {
      collection: "mindCards",
      record: {},
    });
    expect(retired.isError).toBe(true);
    expect(retired.text).toMatch(/collection/);
  });

  it("returns CONFLICT for a duplicate explicit id", async () => {
    const client = await connect("wt-duplicate");
    const args = {
      collection: "movies",
      id: "m_dune",
      record: {
        title: "Dune",
        director: "Villeneuve",
        status: "queued",
        rating: null,
        note: "",
        year: null,
        watchedAt: null,
      },
    };
    await callTool(client, "create_record", args);
    const second = await callTool(client, "create_record", args);
    expect(second.payload).toMatchObject({ code: "CONFLICT" });
  });

  it("AC24: an evening pause in Toronto closes its span on the Toronto date", async () => {
    const uid = "wt-ac24";
    const client = await connect(uid);
    await seedValueAndHabit(client);
    nowMs = Date.parse("2026-11-18T03:00:00Z");
    await callTool(client, "set_habit_state", { id: "h_run", state: "pause" });
    nowMs = EVENING_IN_TORONTO;
    await callTool(client, "set_habit_state", { id: "h_run", state: "resume" });
    expect(await readDoc(uid, "habits/h_run")).toMatchObject({
      pausedAt: null,
      pausedSpans: [{ from: "2026-11-17", to: "2026-11-19" }],
    });
  });

  it("AC25: a doc changed between plan and commit is re-planned, never overwritten", async () => {
    const uid = "wt-ac25";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "tasks",
      id: "t_shared",
      record: { title: "Shared" },
    });
    let raceCount = 0;
    const raceNote = async () => {
      const stored = await readDoc(uid, "tasks/t_shared");
      raceCount += 1;
      const note = raceCount === 1 ? "from the app" : `app edit ${raceCount}`;
      // Same updatedAt, new content: only the snapshot's updateTime can tell.
      await firestore.doc(`users/${uid}/tasks/t_shared`).set({ ...stored, note });
    };
    faults.reset();
    faults.beforeTransaction(1, raceNote);
    const outcome = await callTool(client, "set_task_status", { id: "t_shared", status: "done" });
    expect(outcome.isError).toBe(false);
    expect(await readDoc(uid, "tasks/t_shared")).toMatchObject({
      note: "from the app",
      status: "done",
    });

    faults.reset();
    for (const call of [1, 2, 3]) faults.beforeTransaction(call, raceNote);
    const exhausted = await callTool(client, "set_task_status", { id: "t_shared", status: "skip" });
    expect(exhausted.payload).toMatchObject({ code: "CONFLICT" });
  });

  it("AC26: cardPrefs keeps migratedAt and can't be deleted", async () => {
    const uid = "wt-ac26";
    const client = await connect(uid);
    await seedRows(uid, "cardPrefs", [
      {
        id: "feed",
        mode: "mix",
        types: [],
        categories: [],
        view: "rows",
        migratedAt: "2026-06-01T00:00:00.000Z",
      } as { id: string },
    ]);
    await callTool(client, "update_record", {
      collection: "cardPrefs",
      id: "feed",
      patch: { view: "gallery" },
    });
    expect(await readDoc(uid, "cardPrefs/feed")).toMatchObject({
      view: "gallery",
      migratedAt: "2026-06-01T00:00:00.000Z",
    });
    const patched = await callTool(client, "update_record", {
      collection: "cardPrefs",
      id: "feed",
      patch: { migratedAt: null },
    });
    expect(patched.payload).toMatchObject({ code: "BAD_REQUEST" });
    const deleted = await callTool(client, "delete_record", {
      collection: "cardPrefs",
      id: "feed",
    });
    expect(deleted.payload).toMatchObject({ code: "BAD_REQUEST" });
    expect(await readDoc(uid, "cardPrefs/feed")).toBeDefined();
  });

  it("commits a 500-task goal delete in two chunks, parent last; a failed second chunk reports what landed", async () => {
    const uid = "wt-chunks";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_big",
      record: { name: "Big" },
    });
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_big",
      record: { name: "Big", valueId: "v_big" },
    });
    await seedRows(
      uid,
      "tasks",
      Array.from({ length: 500 }, (_, index) =>
        buildTask({ id: `t_${index}`, goalId: "g_big" }, index),
      ),
    );

    const preview = await previewDigest(client, { collection: "goals", id: "g_big" });
    faults.reset();
    faults.failTransaction(2);
    reconciles = [];
    const failed = await callTool(client, "delete_record", {
      collection: "goals",
      id: "g_big",
      confirmCascade: preview.digest,
    });
    expect(failed.payload).toMatchObject({ code: "INTERNAL", failedAtOperation: 449 });
    expect((failed.payload.committedIds as Record<string, string[]>).tasks).toHaveLength(449);
    expect(await readDoc(uid, "goals/g_big")).toBeDefined();
    expect(reconciles).toEqual([uid]);

    const rest = await previewDigest(client, { collection: "goals", id: "g_big" });
    expect(
      (rest.payload.affected as { updated: Record<string, string[]> }).updated.tasks,
    ).toHaveLength(51);
    const finished = await callTool(client, "delete_record", {
      collection: "goals",
      id: "g_big",
      confirmCascade: rest.digest,
    });
    expect(finished.isError).toBe(false);
    expect(await readDoc(uid, "goals/g_big")).toBeUndefined();
    expect((await listTasks(uid)).every((task) => task.goalId === null)).toBe(true);
  });

  it("re-plans when a child appears between plan and commit, and previews the new child", async () => {
    const uid = "wt-guard";
    const client = await connect(uid);
    await seedValueAndHabit(client);
    const preview = await previewDigest(client, { collection: "habits", id: "h_run" });
    faults.reset();
    faults.beforeTransaction(1, () =>
      seedRows(uid, "tasks", [buildTask({ id: "t_late", habitId: "h_run", kind: "habit" }, 99)]),
    );
    const outcome = await callTool(client, "delete_record", {
      collection: "habits",
      id: "h_run",
      confirmCascade: preview.digest,
    });
    expect(outcome.payload).toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect((outcome.payload.affected as { removed: { tasks: string[] } }).removed.tasks).toContain(
      "t_late",
    );
    expect(await readDoc(uid, "habits/h_run")).toBeDefined();
  });
});
