import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/features/tasks/model";
import { createHabitsSlice, type HabitsSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));

/** Minimal harness: drive the slice with a local state object, stubbing the
 *  cross-slice bits the habit actions reach for (values + tasks + ensureUpcoming). */
function makeSlice(seed: { tasks?: Task[] } = {}) {
  type State = HabitsSlice & {
    values: { id: string }[];
    tasks: Task[];
    ensureUpcoming: () => void;
  };
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    values: [{ id: "v1" }],
    tasks: seed.tasks ?? [],
    ensureUpcoming: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: test harness for a root-store slice
    ...createHabitsSlice(set as any, get as any, {} as any),
  } as State;
  if (seed.tasks) state.tasks = seed.tasks;
  return { get };
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

  it("schedules instances right away (ensureUpcoming) after add", () => {
    const { get } = makeSlice();
    get().addHabit({ name: "Drink water", time: null });
    expect(get().ensureUpcoming).toHaveBeenCalled();
  });

  it("defaults archivedAt to null (active)", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Workout" });
    expect(h.archivedAt).toBeNull();
  });
});

describe("updateHabit — schedule change rebuilds future instances", () => {
  it("strips future undone non-detached instances, re-runs ensureUpcoming, and persists the schedule", () => {
    const { get } = makeSlice({
      tasks: [
        inst({ id: "future", date: "2999-01-01" }),
        inst({ id: "past", date: "2000-01-01" }),
        inst({ id: "detached", date: "2999-02-01", detached: true }),
      ],
    });
    get().addHabit({ id: "h1", name: "Journal" });
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();

    get().updateHabit("h1", {
      schedule: { type: "monthly", daysOfMonth: [1], lastDay: false },
    });

    const ids = get()
      .tasks.map((t) => t.id)
      .sort();
    expect(ids).toEqual(["detached", "past"]); // "future" stripped
    expect(get().ensureUpcoming).toHaveBeenCalled();
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

  it("archives without regenerating (ensureUpcoming not fired by archive)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();
    get().archiveHabit("h1");
    expect(get().ensureUpcoming).not.toHaveBeenCalled();
  });

  it("archive is idempotent (a no-op when already archived)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    const firstTs = get().habits[0].archivedAt;
    get().archiveHabit("h1");
    expect(get().habits[0].archivedAt).toBe(firstTs);
  });

  it("unarchives: clears archivedAt and calls ensureUpcoming", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().archiveHabit("h1");
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();
    get().unarchiveHabit("h1");
    expect(get().habits[0].archivedAt).toBeNull();
    expect(get().ensureUpcoming).toHaveBeenCalled();
  });

  it("unarchive is idempotent (a no-op on an active habit)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();
    get().unarchiveHabit("h1");
    expect(get().ensureUpcoming).not.toHaveBeenCalled();
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

  it("pauses without regenerating (ensureUpcoming not fired by pause)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();
    get().pauseHabit("h1");
    expect(get().ensureUpcoming).not.toHaveBeenCalled();
  });

  it("pause is idempotent (a no-op when already paused)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    const firstTs = get().habits[0].pausedAt;
    get().pauseHabit("h1");
    expect(get().habits[0].pausedAt).toBe(firstTs);
  });

  it("resumes: clears pausedAt, anchors a fresh stretch (resumedAt), and regenerates", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    get().pauseHabit("h1");
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();
    get().resumeHabit("h1");
    expect(get().habits[0].pausedAt).toBeNull();
    expect(get().habits[0].resumedAt).toBeTruthy();
    expect(get().ensureUpcoming).toHaveBeenCalled();
  });

  it("resume is idempotent (a no-op on an active habit)", () => {
    const { get } = makeSlice();
    get().addHabit({ id: "h1", name: "Journal" });
    (get().ensureUpcoming as ReturnType<typeof vi.fn>).mockClear();
    get().resumeHabit("h1");
    expect(get().ensureUpcoming).not.toHaveBeenCalled();
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
