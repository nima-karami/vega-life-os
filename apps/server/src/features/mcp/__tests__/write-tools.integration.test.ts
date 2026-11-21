import { createHash } from "node:crypto";
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
const NOW_ISO = "2026-11-21T03:30:00.000Z";
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

  async function seedGoalWithTasks(uid: string, client: Client, taskCount: number) {
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
      Array.from({ length: taskCount }, (_, index) =>
        buildTask({ id: `t_${index}`, goalId: "g_big" }, index),
      ),
    );
  }

  async function deleteBigGoal(client: Client, confirmCascade: string) {
    const failed = await callTool(client, "delete_record", {
      collection: "goals",
      id: "g_big",
      confirmCascade,
    });
    expect(failed.payload).toMatchObject({ code: "INTERNAL", failedAtOperation: 449 });
    return failed;
  }

  async function seedArchivedValueWithDailyHabits(uid: string, client: Client) {
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_many",
      record: { name: "Many", archivedAt: "2026-11-01T00:00:00.000Z" },
    });
    const daily = {
      type: "weekly",
      days: [1, 1, 1, 1, 1, 1, 1],
      interval: 1,
      anchor: "2026-11-01",
    };
    await seedRows(
      uid,
      "habits",
      Array.from({ length: 31 }, (_, index) => ({
        id: `h_${index}`,
        name: `H${index}`,
        goalId: null,
        valueId: "v_many",
        icon: "repeat",
        time: null,
        schedule: daily,
        durationMin: 30,
        createdAt: "2026-11-01",
        archivedAt: null,
        pausedAt: null,
        resumedAt: null,
        pausedSpans: [],
        tracked: true,
        plan: "",
      })),
    );
  }

  // A habit stored without a runway, so a check-in is what creates its instance.
  const seedBareHabit = (uid: string, id: string) =>
    seedRows(uid, "habits", [
      {
        id,
        name: "Bare",
        goalId: null,
        valueId: "v_body",
        icon: "repeat",
        time: null,
        schedule: MON_WED_FRI,
        durationMin: 30,
        createdAt: "2026-11-01",
        archivedAt: null,
        pausedAt: null,
        resumedAt: null,
        pausedSpans: [],
        tracked: true,
        plan: "",
      } as { id: string },
    ]);

  const unarchiveMany = (client: Client) =>
    callTool(client, "update_record", {
      collection: "values",
      id: "v_many",
      patch: { archivedAt: null },
    });

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
    const ids = (await listTasks(uid)).map((task) => task.id);
    expect(ids).toContain("t_h_run_2026-11-20");
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
        periodKey: "2026-11-16",
        prompts: [],
        checkIns: [],
        createdAt: "2026-11-16T00:00:00.000Z",
      } as { id: string },
    ]);
    const outcome = await callTool(client, "create_record", {
      collection: "reviews",
      record: { periodKey: "2026-11-16", prompts: [{ q: "win", a: "shipped" }] },
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
    await seedGoalWithTasks(uid, client, 500);

    const preview = await previewDigest(client, { collection: "goals", id: "g_big" });
    faults.reset();
    faults.failTransaction(2);
    reconciles = [];
    const failed = await deleteBigGoal(client, preview.digest);
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

  const affectedIds = (outcome: ToolOutcome, group: "removed" | "updated", collection: string) =>
    (outcome.payload.affected as Record<string, Record<string, string[]>>)[group][collection] ?? [];

  it("refuses the parent removal when a detached child is reattached between chunks", async () => {
    const uid = "wt-reattach";
    const client = await connect(uid);
    await seedGoalWithTasks(uid, client, 500);
    const preview = await previewDigest(client, { collection: "goals", id: "g_big" });
    faults.reset();
    faults.beforeTransaction(2, () =>
      firestore
        .doc(`users/${uid}/tasks/t_0`)
        .update({ goalId: "g_big" })
        .then(() => undefined),
    );
    await deleteBigGoal(client, preview.digest);
    expect(await readDoc(uid, "goals/g_big")).toBeDefined();
    const rest = await previewDigest(client, { collection: "goals", id: "g_big" });
    expect(affectedIds(rest, "updated", "tasks")).toContain("t_0");
  });

  it("re-plans a task create whose goal is deleted before it commits", async () => {
    const uid = "wt-parent-first";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_p",
      record: { name: "P" },
    });
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_p",
      record: { name: "P", valueId: "v_p" },
    });
    faults.reset();
    faults.beforeTransaction(1, () =>
      firestore
        .doc(`users/${uid}/goals/g_p`)
        .delete()
        .then(() => undefined),
    );
    const outcome = await callTool(client, "create_record", {
      collection: "tasks",
      id: "t_child",
      record: { title: "c", goalId: "g_p" },
    });
    expect(outcome.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("goalId"),
    });
    expect(await readDoc(uid, "tasks/t_child")).toBeUndefined();
  });

  it("re-plans a goal delete when a task links to it before the delete commits", async () => {
    const uid = "wt-child-first";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_c",
      record: { name: "C" },
    });
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_c",
      record: { name: "C", valueId: "v_c" },
    });
    faults.reset();
    faults.beforeTransaction(1, () =>
      seedRows(uid, "tasks", [buildTask({ id: "t_new", goalId: "g_c" }, 0)]),
    );
    const outcome = await callTool(client, "delete_record", { collection: "goals", id: "g_c" });
    expect(outcome.payload).toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect(affectedIds(outcome, "updated", "tasks")).toEqual(["t_new"]);
    expect(await readDoc(uid, "goals/g_c")).toBeDefined();
  });

  it("re-plans a check-in when the habit is paused before the new instance commits", async () => {
    const uid = "wt-checkin-race";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_body",
      record: { name: "Body" },
    });
    await seedBareHabit(uid, "h_bare");
    faults.reset();
    faults.beforeTransaction(1, () =>
      firestore
        .doc(`users/${uid}/habits/h_bare`)
        .update({ pausedAt: "2026-11-20T12:00:00.000Z" })
        .then(() => undefined),
    );
    const outcome = await callTool(client, "check_in_habit", { habitId: "h_bare" });
    expect(outcome.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("paused"),
    });
    expect(await readDoc(uid, "tasks/t_h_bare_2026-11-20")).toBeUndefined();
  });

  it("refuses a stale digest once the cascade shrank to the parent alone", async () => {
    const uid = "wt-stale-parent-only";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_s",
      record: { name: "S" },
    });
    await callTool(client, "create_record", {
      collection: "goals",
      id: "g_s",
      record: { name: "S", valueId: "v_s" },
    });
    const preview = await previewDigest(client, { collection: "values", id: "v_s" });
    await firestore.doc(`users/${uid}/goals/g_s`).delete();
    const outcome = await callTool(client, "delete_record", {
      collection: "values",
      id: "v_s",
      confirmCascade: preview.digest,
    });
    expect(outcome.payload).toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect(await readDoc(uid, "values/v_s")).toBeDefined();
  });

  it("finishes a value unarchive whose second chunk failed when the unarchive is replayed", async () => {
    const uid = "wt-unarchive-replay";
    const client = await connect(uid);
    await seedArchivedValueWithDailyHabits(uid, client);
    faults.reset();
    faults.failTransaction(2);
    const failed = await callTool(client, "update_record", {
      collection: "values",
      id: "v_many",
      patch: { archivedAt: null },
    });
    expect(failed.payload).toMatchObject({ code: "INTERNAL" });
    expect((await listTasks(uid)).length).toBeLessThan(31 * 15);
    faults.reset();
    const replay = await callTool(client, "update_record", {
      collection: "values",
      id: "v_many",
      patch: { archivedAt: null },
    });
    expect(replay.isError).toBe(false);
    expect((await listTasks(uid)).length).toBe(31 * 15);
  });

  it("rejects ids that aren't a single record id", async () => {
    const client = await connect("wt-ids");
    const nested = await callTool(client, "create_record", {
      collection: "books",
      record: { id: "b_1/inner", title: "x" },
    });
    expect(nested.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("record.id"),
    });
    const target = await callTool(client, "update_record", {
      collection: "books",
      id: "a/b",
      patch: {},
    });
    expect(target.isError).toBe(true);
    expect(target.text).toContain("ids use letters, digits");
  });

  it("refuses to reuse a natural row id that now belongs to a moved journal entry or review", async () => {
    const uid = "wt-moved-ids";
    const client = await connect(uid);
    await callTool(client, "write_journal", { date: "2026-11-18", journal: "first" });
    await callTool(client, "update_record", {
      collection: "journal",
      id: "day_2026-11-18",
      patch: { date: "2026-11-19" },
    });
    const journal = await callTool(client, "write_journal", {
      date: "2026-11-18",
      journal: "second",
    });
    expect(journal.payload).toMatchObject({ code: "CONFLICT" });
    expect(await readDoc(uid, "journal/day_2026-11-18")).toMatchObject({
      date: "2026-11-19",
      journal: "first",
    });

    await callTool(client, "create_record", {
      collection: "reviews",
      record: { periodKey: "2026-11-16", prompts: [] },
    });
    await callTool(client, "update_record", {
      collection: "reviews",
      id: "rv_2026-11-16",
      patch: { periodKey: "2026-11-23" },
    });
    const review = await callTool(client, "create_record", {
      collection: "reviews",
      record: { periodKey: "2026-11-16", prompts: [] },
    });
    expect(review.payload).toMatchObject({ code: "CONFLICT" });
  });

  it("refuses a check-in whose slot id is held by a task unlinked from the habit", async () => {
    const uid = "wt-unlinked-slot";
    const client = await connect(uid);
    await seedValueAndHabit(client);
    await callTool(client, "update_record", {
      collection: "tasks",
      id: "t_h_run_2026-11-20",
      patch: { habitId: null },
    });
    const outcome = await callTool(client, "check_in_habit", { habitId: "h_run" });
    expect(outcome.payload).toMatchObject({ code: "CONFLICT" });
    expect(await readDoc(uid, "tasks/t_h_run_2026-11-20")).toMatchObject({
      habitId: null,
      status: "todo",
    });
  });

  it("keeps one journal entry per date and one review per period under competing ids", async () => {
    const uid = "wt-logical-keys";
    const client = await connect(uid);
    faults.reset();
    faults.beforeTransaction(1, () =>
      seedRows(uid, "journal", [
        {
          id: "day_other",
          date: "2026-11-15",
          gratitude: [],
          mood: null,
          journal: "theirs",
          createdAt: NOW_ISO,
        } as { id: string },
      ]),
    );
    const journal = await callTool(client, "create_record", {
      collection: "journal",
      id: "day_mine",
      record: { date: "2026-11-15", journal: "mine" },
    });
    expect(journal.payload).toMatchObject({ code: "CONFLICT" });
    expect(await readDoc(uid, "journal/day_mine")).toBeUndefined();

    await callTool(client, "create_record", {
      collection: "reviews",
      record: { periodKey: "2026-11-30", prompts: [] },
    });
    faults.reset();
    faults.beforeTransaction(1, () =>
      seedRows(uid, "reviews", [
        {
          id: "rv_theirs",
          periodKey: "2026-12-07",
          prompts: [],
          checkIns: [],
          createdAt: NOW_ISO,
        } as { id: string },
      ]),
    );
    const moved = await callTool(client, "update_record", {
      collection: "reviews",
      id: "rv_2026-11-30",
      patch: { periodKey: "2026-12-07" },
    });
    expect(moved.payload).toMatchObject({ code: "CONFLICT" });
  });

  it("re-plans a runway that collides with a slot claimed meanwhile, keeping the claimed instance", async () => {
    const uid = "wt-slot-race";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_body",
      record: { name: "Body" },
    });
    faults.reset();
    faults.beforeTransaction(1, () =>
      seedRows(uid, "tasks", [
        buildTask(
          {
            id: "t_h_run_2026-11-20",
            kind: "habit",
            habitId: "h_run",
            valueId: "v_body",
            date: "2026-11-20",
            title: "claimed",
          },
          0,
        ),
      ]),
    );
    const created = await callTool(client, "create_record", {
      collection: "habits",
      id: "h_run",
      record: { name: "Run", valueId: "v_body", schedule: MON_WED_FRI },
    });
    expect(created.isError).toBe(false);
    const today = (await listTasks(uid)).filter((task) => task.date === "2026-11-20");
    expect(today).toEqual([
      expect.objectContaining({ id: "t_h_run_2026-11-20", title: "claimed" }),
    ]);
  });

  it("runs a legacy habit (days, no schedule) through check-in and the runway", async () => {
    const uid = "wt-legacy";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_old",
      record: { name: "Old" },
    });
    await seedRows(uid, "habits", [
      {
        id: "h_old",
        name: "Old",
        goalId: null,
        valueId: "v_old",
        icon: "repeat",
        time: null,
        days: [1, 1, 1, 1, 1, 1, 1],
        durationMin: 30,
        createdAt: "2026-10-01",
        archivedAt: null,
      } as { id: string },
    ]);
    const checkIn = await callTool(client, "check_in_habit", { habitId: "h_old" });
    expect(checkIn.payload).toMatchObject({
      created: true,
      record: { id: "t_h_old_2026-11-20", status: "done" },
    });
    await callTool(client, "set_habit_state", { id: "h_old", state: "pause" });
    const resumed = await callTool(client, "set_habit_state", { id: "h_old", state: "resume" });
    expect(resumed.isError).toBe(false);
    expect((await listTasks(uid)).filter((task) => task.habitId === "h_old")).toHaveLength(15);
    expect(await readDoc(uid, "habits/h_old")).toMatchObject({ schedule: { type: "weekly" } });
  });

  it("returns the canonical stored row, defaults included, and the stored row on a replay", async () => {
    const uid = "wt-canonical";
    const client = await connect(uid);
    const created = await callTool(client, "create_record", {
      collection: "cardPrefs",
      id: "feed",
      record: {},
    });
    const { fieldUpdatedAt: _stamps, ...stored } = (await readDoc(uid, "cardPrefs/feed")) ?? {};
    expect(created.payload.record).toEqual(stored);
    expect(created.payload.record).toMatchObject({
      mode: "mix",
      migratedAt: null,
      updatedAt: expect.any(String),
    });
    nowMs += 60_000;
    const replay = await callTool(client, "update_record", {
      collection: "cardPrefs",
      id: "feed",
      patch: { mode: "mix" },
    });
    expect(replay.payload).toMatchObject({ record: stored, writtenCount: 0, syncVersion: null });
  });

  it("lists an inherited property name under ignoredKeys", async () => {
    const client = await connect("wt-tostring");
    const outcome = await callTool(client, "create_record", {
      collection: "movies",
      record: {
        title: "Dune",
        director: "V",
        status: "queued",
        rating: null,
        note: "",
        year: null,
        watchedAt: null,
        toString: "x",
      },
    });
    expect(outcome.payload).toMatchObject({ ignoredKeys: ["toString"] });
  });

  it("keeps a category a merchant starts using between the preview and the delete", async () => {
    const uid = "wt-category-race";
    const client = await connect(uid);
    await seedRows(uid, "financeCategories", [
      {
        id: "fcat_fun",
        name: "Fun",
        kind: "spend",
        order: 0,
        colorIndex: null,
        archivedAt: null,
      } as { id: string },
    ]);
    await seedRows(uid, "financeBudgets", [
      { id: "fcat_fun:2026-11", categoryId: "fcat_fun", month: "2026-11", cents: 100 } as {
        id: string;
      },
    ]);
    const preview = await previewDigest(client, {
      collection: "financeCategories",
      id: "fcat_fun",
    });
    faults.reset();
    faults.beforeTransaction(1, () =>
      seedRows(uid, "financeMerchants", [
        { id: "fmer_1", pattern: "x", displayName: "X", defaultCategoryId: "fcat_fun" } as {
          id: string;
        },
      ]),
    );
    const outcome = await callTool(client, "delete_record", {
      collection: "financeCategories",
      id: "fcat_fun",
      confirmCascade: preview.digest,
    });
    expect(outcome.payload).toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("merchant"),
    });
    expect(await readDoc(uid, "financeCategories/fcat_fun")).toBeDefined();
    expect(await readDoc(uid, "financeBudgets/fcat_fun:2026-11")).toBeDefined();
  });

  it("re-plans a value unarchive when a source habit is deleted before the first chunk commits", async () => {
    const uid = "wt-unarchive-habit-race";
    const client = await connect(uid);
    await seedArchivedValueWithDailyHabits(uid, client);
    faults.reset();
    faults.beforeTransaction(1, () =>
      firestore
        .doc(`users/${uid}/habits/h_0`)
        .delete()
        .then(() => undefined),
    );
    const outcome = await unarchiveMany(client);
    expect(outcome.isError).toBe(false);
    const tasks = await listTasks(uid);
    expect(tasks.filter((task) => task.habitId === "h_0")).toEqual([]);
    expect(tasks).toHaveLength(30 * 15);
  });

  it("stops a value unarchive at the next chunk when the value is archived again in between", async () => {
    const uid = "wt-unarchive-value-race";
    const client = await connect(uid);
    await seedArchivedValueWithDailyHabits(uid, client);
    faults.reset();
    faults.beforeTransaction(2, () =>
      firestore
        .doc(`users/${uid}/values/v_many`)
        .update({ archivedAt: "2026-11-20T23:00:00.000Z" })
        .then(() => undefined),
    );
    const outcome = await unarchiveMany(client);
    expect(outcome.payload).toMatchObject({ code: "INTERNAL", failedAtOperation: 450 });
    const value = await firestore.doc(`users/${uid}/values/v_many`).get();
    expect(value.get("archivedAt")).toBe("2026-11-20T23:00:00.000Z");
    expect(await listTasks(uid)).toHaveLength(449);
  });

  it("reports no created tasks when a habit's schedule is reapplied unchanged", async () => {
    const client = await connect("wt-reapply");
    await seedValueAndHabit(client);
    const outcome = await callTool(client, "update_record", {
      collection: "habits",
      id: "h_run",
      patch: { schedule: MON_WED_FRI },
    });
    expect(outcome.payload).toMatchObject({ createdTaskIds: [] });
  });

  it("gives a 128-character habit's tasks addressable slot ids shared with check-in", async () => {
    const uid = "wt-long-habit";
    const client = await connect(uid);
    await callTool(client, "create_record", {
      collection: "values",
      id: "v_body",
      record: { name: "Body" },
    });
    const longId = `h_${"y".repeat(126)}`;
    const created = await callTool(client, "create_record", {
      collection: "habits",
      id: longId,
      record: { name: "Long", valueId: "v_body", schedule: MON_WED_FRI },
    });
    expect(created.isError).toBe(false);
    const slotHash = createHash("sha256").update(longId).digest("base64url").slice(0, 22);
    const todayId = `th_${slotHash}_2026-11-20`;
    expect((await listTasks(uid)).map((task) => task.id)).toContain(todayId);
    const status = await callTool(client, "set_task_status", { id: todayId, status: "done" });
    expect(status.payload).toMatchObject({ record: { id: todayId, status: "done" } });

    const bareId = `h_${"z".repeat(126)}`;
    await seedBareHabit(uid, bareId);
    const bareHash = createHash("sha256").update(bareId).digest("base64url").slice(0, 22);
    const checkIn = await callTool(client, "check_in_habit", { habitId: bareId });
    expect(checkIn.payload).toMatchObject({
      created: true,
      record: { id: `th_${bareHash}_2026-11-20` },
    });
  });
});
