import { describe, expect, it, vi } from "vitest";
import { shiftISO, todayISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { createHabitsSlice, type HabitsSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulkPut: vi.fn(async () => ({})),
  saveBulkRemove: vi.fn(async () => ({})),
}));

/** Minimal harness: drive the slice with a local state object, seeding the
 *  cross-slice bits the habit actions reach for (values + tasks). */
function makeSlice(
  seed: {
    tasks?: Task[];
    values?: { id: string; archivedAt: string | null; restingAt: string | null }[];
  } = {},
) {
  type State = HabitsSlice & {
    values: { id: string; archivedAt: string | null; restingAt: string | null }[];
    tasks: Task[];
  };
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    values: seed.values ?? [{ id: "v1", archivedAt: null, restingAt: null }],
    tasks: seed.tasks ?? [],
    // biome-ignore lint/suspicious/noExplicitAny: test harness for a root-store slice
    ...createHabitsSlice(set as any, get as any, {} as any),
  } as State;
  if (seed.tasks) state.tasks = seed.tasks;
  return { get };
}

/** The generated runway: h1's instances from today through the 14-day horizon. */
function runwayOf(get: () => { tasks: Task[] }): Task[] {
  const today = todayISO();
  const horizon = shiftISO(today, 14);
  return get().tasks.filter(
    (t) => t.habitId === "h1" && t.date != null && t.date >= today && t.date <= horizon,
  );
}

const inst = (over: Partial<Task> = {}): Task =>
  ({
    id: "t",
    title: "x",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: "v1",
    date: "2999-01-01",
    time: "09:00",
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...over,
  }) as Task;

describe("addHabit — compass defaults", () => {
  it("is untracked with an empty plan by default", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Stretch" });
    expect(h.tracked).toBe(false);
    expect(h.plan).toBe("");
  });

  it("honours an explicit tracked/plan", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ tracked: true, plan: "When I wake, I stretch." });
    expect(h.tracked).toBe(true);
    expect(h.plan).toBe("When I wake, I stretch.");
  });

  it("defaults the value to the first in-season one, not a resting one", () => {
    const { get } = makeSlice({
      values: [
        { id: "v1", archivedAt: null, restingAt: "2026-10-01T00:00:00.000Z" },
        { id: "v2", archivedAt: null, restingAt: null },
      ],
    });
    expect(get().addHabit({ name: "x" }).valueId).toBe("v2");
  });

  it("falls back to a resting value when none is in season", () => {
    const { get } = makeSlice({
      values: [{ id: "v1", archivedAt: null, restingAt: "2026-10-01T00:00:00.000Z" }],
    });
    expect(get().addHabit({ name: "x" }).valueId).toBe("v1");
  });
});

describe("addHabit — time handling", () => {
  it("defaults to 09:00 when time is omitted", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Workout" });
    expect(h.time).toBe("09:00");
  });

  it("preserves an explicit null time (anytime habit) instead of coercing to 09:00", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Drink water", time: null });
    expect(h.time).toBeNull();
  });

  it("schedules the whole runway right away after add", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Drink water", time: null });
    expect(runwayOf(get)).toHaveLength(15);
  });

  it("defaults archivedAt to null (active)", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Workout" });
    expect(h.archivedAt).toBeNull();
  });
});

describe("updateHabit — schedule change rebuilds future instances", () => {
  it("strips future undone non-detached instances, rebuilds the runway, and persists the schedule", () => {
    const seeded = ["future", "past", "detached"];
    const { get } = makeSlice({
      tasks: [
        inst({ id: "future", date: "2999-01-01" }),
        inst({ id: "past", date: "2000-01-01" }),
        inst({ id: "detached", date: "2999-02-01", detached: true }),
      ],
    });
    get().addHabit({ id: "h1", name: "Journal" });

    get().updateHabit("h1", {
      schedule: { type: "monthly", daysOfMonth: [1], lastDay: false },
    });

    const ids = get()
      .tasks.map((t) => t.id)
      .filter((id) => seeded.includes(id))
      .sort();
    expect(ids).toEqual(["detached", "past"]); // "future" stripped
    const firsts = Array.from({ length: 15 }, (_, i) => shiftISO(todayISO(), i)).filter((iso) =>
      iso.endsWith("-01"),
    );
    expect(runwayOf(get).map((t) => t.date)).toEqual(firsts); // the daily runway is rebuilt monthly
    expect(get().habits[0].schedule).toEqual({ type: "monthly", daysOfMonth: [1], lastDay: false });
  });
});

describe("archiveHabit / unarchiveHabit", () => {
  it("archives: sets archivedAt and strips future undone non-detached instances", () => {
    const { get } = makeSlice({
      tasks: [
        inst({ id: "future", date: "2999-01-01" }),
        inst({ id: "past", date: "2000-01-01" }),
        inst({ id: "detached", date: "2999-02-01", detached: true }),
        inst({ id: "done", date: "2999-03-01", status: "done" }),
      ],
    });
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    expect(get().habits[0].archivedAt).toBeTruthy();
    const ids = get()
      .tasks.map((t) => t.id)
      .sort();
    expect(ids).toEqual(["detached", "done", "past"]);
  });

  it("archives without regenerating the runway it stripped", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    expect(runwayOf(get)).toEqual([]);
  });

  it("archive is idempotent (a no-op when already archived)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    const firstTs = get().habits[0].archivedAt;
    get().archiveHabit("h1");
    expect(get().habits[0].archivedAt).toBe(firstTs);
  });

  it("unarchives: clears archivedAt and regenerates the runway", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    get().unarchiveHabit("h1");
    expect(get().habits[0].archivedAt).toBeNull();
    expect(runwayOf(get)).toHaveLength(15);
  });

  it("unarchive is idempotent (a no-op on an active habit)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    const before = get().tasks;
    get().unarchiveHabit("h1");
    expect(get().tasks).toBe(before);
  });
});

describe("pauseHabit / resumeHabit", () => {
  it("pauses: sets pausedAt and strips future undone non-detached instances (history kept)", () => {
    const { get } = makeSlice({
      tasks: [
        inst({ id: "future", date: "2999-01-01" }),
        inst({ id: "past", date: "2000-01-01" }),
        inst({ id: "detached", date: "2999-02-01", detached: true }),
        inst({ id: "done", date: "2999-03-01", status: "done" }),
      ],
    });
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    expect(get().habits[0].pausedAt).toBeTruthy();
    const ids = get()
      .tasks.map((t) => t.id)
      .sort();
    expect(ids).toEqual(["detached", "done", "past"]); // "future" stripped
  });

  it("pauses without regenerating the runway it stripped", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    expect(runwayOf(get)).toEqual([]);
  });

  it("pause is idempotent (a no-op when already paused)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    const firstTs = get().habits[0].pausedAt;
    get().pauseHabit("h1");
    expect(get().habits[0].pausedAt).toBe(firstTs);
  });

  it("resumes: clears pausedAt, stamps resumedAt, and regenerates", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    get().resumeHabit("h1");
    expect(get().habits[0].pausedAt).toBeNull();
    expect(get().habits[0].resumedAt).toBeTruthy();
    expect(runwayOf(get)).toHaveLength(15);
  });

  describe("paused spans", () => {
    const at = (iso: string) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(iso));
    };

    it("resumes: appends {from: pause date, to: yesterday} and keeps resumedAt", () => {
      try {
        const { get } = makeSlice();
        at("2026-06-08T12:00:00");
        get().addHabit({ id: "h1", name: "Journal" });
        at("2026-06-10T12:00:00");
        get().pauseHabit("h1");
        at("2026-06-14T12:00:00");
        get().resumeHabit("h1");
        expect(get().habits[0].pausedSpans).toEqual([{ from: "2026-06-10", to: "2026-06-13" }]);
        expect(get().habits[0].resumedAt).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it("archiving a paused habit closes the open pause into a span", () => {
      try {
        const { get } = makeSlice();
        at("2026-06-08T12:00:00");
        get().addHabit({ id: "h1", name: "Journal" });
        at("2026-06-10T12:00:00");
        get().pauseHabit("h1");
        at("2026-06-14T12:00:00");
        get().archiveHabit("h1");
        expect(get().habits[0].pausedAt).toBeNull();
        expect(get().habits[0].pausedSpans).toEqual([{ from: "2026-06-10", to: "2026-06-13" }]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("same-day pause and resume appends nothing", () => {
      try {
        const { get } = makeSlice();
        at("2026-06-10T09:00:00");
        get().addHabit({ id: "h1", name: "Journal" });
        get().pauseHabit("h1");
        at("2026-06-10T18:00:00");
        get().resumeHabit("h1");
        expect(get().habits[0].pausedSpans).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps the inferred legacy span when a later pause resumes", () => {
      try {
        const slots = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"];
        const { get } = makeSlice({
          tasks: slots.map((d) => inst({ id: d, date: d, slotDate: d, status: "done" })),
        });
        at("2026-06-08T12:00:00");
        get().addHabit({ id: "h1", name: "Journal", resumedAt: "2026-06-08T08:00:00" });
        at("2026-06-10T12:00:00");
        get().pauseHabit("h1");
        at("2026-06-14T12:00:00");
        get().resumeHabit("h1");
        expect(get().habits[0].pausedSpans).toEqual([
          { from: "2026-06-05", to: "2026-06-07" },
          { from: "2026-06-10", to: "2026-06-13" },
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("resume is idempotent (a no-op on an active habit)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    const before = get().tasks;
    get().resumeHabit("h1");
    expect(get().tasks).toBe(before);
  });

  it("archiving a paused habit clears pausedAt so unarchive returns it to active", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    get().archiveHabit("h1");
    expect(get().habits[0].archivedAt).toBeTruthy();
    expect(get().habits[0].pausedAt).toBeNull();
    get().unarchiveHabit("h1");
    expect(get().habits[0].archivedAt).toBeNull();
    expect(get().habits[0].pausedAt).toBeNull(); // active, not paused
  });

  it("cannot pause an archived habit (guarded — archive supersedes)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    get().pauseHabit("h1");
    expect(get().habits[0].pausedAt).toBeNull();
  });
});
