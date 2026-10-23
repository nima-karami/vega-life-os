import type { CalendarEvent } from "@vega/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shiftISO, todayISO } from "@/core/lib/date";
import { persistence } from "@/core/persistence";
import { TrpcAdapter } from "@/core/persistence/trpc-adapter";
import type { TrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { setPersistAuth } from "@/core/store/persist";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";

vi.mock("@/core/persistence/sandbox-meta", () => ({
  setSandboxDirty: vi.fn(),
  getSandboxDirty: vi.fn(async () => false),
  isSandboxDirty: () => false,
}));

/** Every tRPC mutation the adapter issues, by `router.procedure`. */
const mutations: { path: string; input: unknown }[] = [];
let failingPath: string | null = null;
let serverVersion = 0;

function respondTo(path: string, input: unknown) {
  serverVersion += 1;
  const syncVersion = serverVersion;
  if (path === "data.importCollection") {
    const inserted = (input as { records: unknown[] }).records.length;
    return { inserted, skipped: 0, writtenChunks: 1, syncVersion };
  }
  if (path === "data.bulkRemove") {
    const removed = (input as { ids: string[] }).ids.length;
    return { removed, missing: 0, writtenChunks: 1, syncVersion };
  }
  return { ...(input as object), syncVersion };
}

function procedure(path: string) {
  return {
    mutate: async (input: unknown) => {
      mutations.push({ path, input });
      if (path === failingPath) throw new Error("backend down");
      return respondTo(path, input);
    },
    // A reconciling refetch fails, so a rollback is the only thing that moves the store.
    query: () => Promise.reject(new Error("backend down")),
  };
}

const fakeClient = new Proxy(
  {},
  {
    get: (_root, router: string) =>
      new Proxy({}, { get: (_router, name: string) => procedure(`${router}.${name}`) }),
  },
) as TrpcClient;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function tallyMutations(): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const { path } of mutations) tally[path] = (tally[path] ?? 0) + 1;
  return tally;
}

/** Store notifications and tRPC mutations one action costs. */
async function measure(action: () => void) {
  let notifications = 0;
  const unsubscribe = useStore.subscribe(() => {
    notifications += 1;
  });
  mutations.length = 0;
  action();
  unsubscribe();
  await flush();
  return { notifications, mutations: tallyMutations() };
}

const today = todayISO();
const EVERY_DAY = [1, 1, 1, 1, 1, 1, 1];

const value = (id: string): Value =>
  ({ id, name: id, icon: "compass", hue: "#3B82C4", order: 0, archivedAt: null }) as Value;

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id,
  name: `Habit ${id}`,
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: "07:00",
  durationMin: 20,
  createdAt: shiftISO(today, -60),
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: false,
  plan: "",
  schedule: { type: "weekly", days: EVERY_DAY, interval: 1, anchor: shiftISO(today, -60) },
  ...over,
});

const instance = (id: string, date: string, over: Partial<Task> = {}): Task => ({
  id,
  title: "Habit h1",
  kind: "habit",
  habitId: "h1",
  goalId: null,
  valueId: "v1",
  date,
  slotDate: date,
  completedAt: null,
  time: "07:00",
  durationMin: 20,
  status: date < today ? "done" : "todo",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

/** Thirty days of history up to yesterday, plus the full runway ahead. */
function longHistory(): Task[] {
  const past = Array.from({ length: 30 }, (_, index) =>
    instance(`past-${index}`, shiftISO(today, index - 30)),
  );
  const ahead = Array.from({ length: 15 }, (_, index) =>
    instance(`ahead-${index}`, shiftISO(today, index)),
  );
  return [...past, ...ahead];
}

function seed(state: {
  values?: Value[];
  goals?: Goal[];
  habits?: Habit[];
  tasks?: Task[];
  calendarEvents?: CalendarEvent[];
}) {
  useStore.setState({
    authUid: "u-bulk",
    toast: null,
    values: state.values ?? [value("v1")],
    goals: state.goals ?? [],
    habits: state.habits ?? [],
    tasks: state.tasks ?? [],
    calendarEvents: state.calendarEvents ?? [],
  });
}

beforeEach(() => {
  persistence.setDelegate(new TrpcAdapter(fakeClient));
  setPersistAuth("u-bulk");
  failingPath = null;
  mutations.length = 0;
});
afterEach(() => setPersistAuth(null));

describe("habit instance generation is one store update and one bulk write", () => {
  it("ensureUpcoming fills an empty runway", async () => {
    seed({ habits: [habit("h1")] });

    const cost = await measure(() => useStore.getState().ensureUpcoming(14));

    expect(useStore.getState().tasks).toHaveLength(15);
    expect(cost).toEqual({ notifications: 1, mutations: { "data.importCollection": 1 } });
  });

  it("ensureUpcoming with nothing to do touches neither the store nor the backend", async () => {
    seed({ habits: [habit("h1")], tasks: longHistory() });

    const cost = await measure(() => useStore.getState().ensureUpcoming(14));

    expect(cost).toEqual({ notifications: 0, mutations: {} });
  });

  it("planWeek fills the week", async () => {
    seed({ habits: [habit("h1")] });

    const cost = await measure(() => useStore.getState().planWeek());

    expect(cost).toEqual({ notifications: 1, mutations: { "data.importCollection": 1 } });
  });
});

describe("habit edits", () => {
  it("a schedule change rebuilds the runway in one update", async () => {
    seed({ habits: [habit("h1")], tasks: longHistory() });
    const weekdays = { type: "weekly" as const, days: [1, 1, 1, 1, 1, 0, 0], interval: 1 };

    const cost = await measure(() =>
      useStore.getState().updateHabit("h1", {
        schedule: { ...weekdays, anchor: shiftISO(today, -60) },
      }),
    );

    expect(cost).toEqual({
      notifications: 1,
      mutations: { "habits.upsert": 1, "data.bulkRemove": 1, "data.importCollection": 1 },
    });
    const past = useStore.getState().tasks.filter((task) => task.id.startsWith("past-"));
    expect(past).toHaveLength(30);
  });

  it("removing a habit deletes its whole history in one bulk call", async () => {
    seed({ habits: [habit("h1")], tasks: longHistory() });

    const cost = await measure(() => useStore.getState().removeHabit("h1"));

    expect(useStore.getState().tasks).toEqual([]);
    expect(cost).toEqual({
      notifications: 1,
      mutations: { "habits.delete": 1, "data.bulkRemove": 1 },
    });
    const removal = mutations.find((call) => call.path === "data.bulkRemove");
    expect((removal?.input as { ids: string[] }).ids).toHaveLength(45);
  });

  it("archiving strips the runway in one bulk call", async () => {
    seed({ habits: [habit("h1")], tasks: longHistory() });

    const cost = await measure(() => useStore.getState().archiveHabit("h1"));

    expect(cost).toEqual({
      notifications: 1,
      mutations: { "habits.upsert": 1, "data.bulkRemove": 1 },
    });
  });

  it("adding a habit schedules it in the same update", async () => {
    seed({});

    const cost = await measure(() => useStore.getState().addHabit({ name: "Read" }));

    expect(cost).toEqual({
      notifications: 1,
      mutations: { "habits.upsert": 1, "data.importCollection": 1 },
    });
  });

  it("resuming a habit regenerates in the same update", async () => {
    seed({ habits: [habit("h1", { pausedAt: shiftISO(today, -3) })] });

    const cost = await measure(() => useStore.getState().resumeHabit("h1"));

    expect(cost).toEqual({
      notifications: 1,
      mutations: { "habits.upsert": 1, "data.importCollection": 1 },
    });
  });
});

describe("bulk task actions", () => {
  it("bulkUpdateTasks writes every row in one call", async () => {
    seed({ habits: [habit("h1")], tasks: longHistory() });
    const ids = useStore.getState().tasks.map((task) => task.id);

    const cost = await measure(() => useStore.getState().bulkUpdateTasks(ids, { valueId: "v2" }));

    expect(cost).toEqual({ notifications: 1, mutations: { "data.importCollection": 1 } });
  });

  it("bulkRemoveTasks deletes every row in one call", async () => {
    seed({ habits: [habit("h1")], tasks: longHistory() });
    const ids = useStore.getState().tasks.map((task) => task.id);

    const cost = await measure(() => useStore.getState().bulkRemoveTasks(ids));

    expect(cost).toEqual({ notifications: 1, mutations: { "data.bulkRemove": 1 } });
  });

  it("updateTasks reorders a day in one call and keeps the habit slot lock", async () => {
    const day = Array.from({ length: 30 }, (_, index) =>
      instance(`row-${index}`, today, { slotDate: undefined, order: index }),
    );
    seed({ habits: [habit("h1")], tasks: day });

    const cost = await measure(() =>
      useStore
        .getState()
        .updateTasks(day.map((task, index) => ({ id: task.id, patch: { order: 29 - index } }))),
    );

    expect(cost).toEqual({ notifications: 1, mutations: { "data.importCollection": 1 } });
    const rows = useStore.getState().tasks;
    expect(rows.map((task) => task.order)).toEqual(day.map((_, index) => 29 - index));
    expect(rows.every((task) => task.slotDate === today)).toBe(true);
  });
});

describe("cascades", () => {
  it("removing a value cascades in one update and one call per collection", async () => {
    seed({
      values: [value("v1")],
      goals: [{ id: "g1", valueId: "v1" } as Goal],
      habits: [habit("h1")],
      tasks: longHistory(),
    });

    const cost = await measure(() => useStore.getState().removeValue("v1"));

    expect(cost).toEqual({
      notifications: 1,
      mutations: { "values.delete": 1, "data.bulkRemove": 3 },
    });
  });

  it("removing a goal detaches its dependents in one call per collection", async () => {
    seed({
      goals: [{ id: "g1", valueId: "v1" } as Goal],
      habits: [habit("h1", { goalId: "g1" })],
      tasks: longHistory().map((task) => ({ ...task, goalId: "g1" })),
    });

    const cost = await measure(() => useStore.getState().removeGoal("g1"));

    expect(cost).toEqual({
      notifications: 1,
      mutations: { "goals.delete": 1, "data.importCollection": 2 },
    });
  });

  it("tagging a shared invite writes every copy in one call", async () => {
    const copies = ["e1", "e2", "e3"].map(
      (id) => ({ id, iCalUID: "shared", title: "Standup" }) as CalendarEvent,
    );
    seed({ calendarEvents: copies });

    const cost = await measure(() => useStore.getState().tagEvent("e1", { valueId: "v1" }));

    expect(cost).toEqual({ notifications: 1, mutations: { "data.importCollection": 1 } });
  });
});

describe("a rejected bulk write never leaves rows the backend refused", () => {
  it("ensureUpcoming drops the instances it could not save", async () => {
    seed({ habits: [habit("h1")] });
    failingPath = "data.importCollection";

    useStore.getState().ensureUpcoming(14);
    await flush();

    expect(useStore.getState().tasks).toEqual([]);
    expect(useStore.getState().toast?.action?.label).toBe("Retry");
  });

  it("a failed stale-instance prune puts the instances back", async () => {
    const stale = instance("stale", shiftISO(today, 2));
    const monthly = habit("h1", {
      schedule: { type: "monthly", daysOfMonth: [], lastDay: false },
    });
    seed({ habits: [monthly], tasks: [stale] });
    failingPath = "data.bulkRemove";

    useStore.getState().ensureUpcoming(14);
    await flush();

    expect(useStore.getState().tasks.map((task) => task.id)).toEqual(["stale"]);
  });
});
