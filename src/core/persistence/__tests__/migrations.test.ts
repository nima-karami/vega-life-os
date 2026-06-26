import { describe, expect, it, vi } from "vitest";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import { DATA_VERSION, migrateData, runDataMigrations } from "../migrations";

vi.mock("@/core/store/persist", () => ({ savePut: vi.fn(), saveRemove: vi.fn() }));

const legacyHabit = (over: Partial<Habit> = {}): Habit =>
  ({
    id: "h1",
    name: "Water plants",
    goalId: null,
    valueId: "v1",
    icon: "repeat",
    time: null,
    durationMin: 30,
    createdAt: "2026-06-01",
    archivedAt: null,
    schedule: { type: "monthly", daysOfMonth: [15], lastDay: false },
    // retired fields a stored record still carries:
    days: [1, 1, 1, 1, 1, 1, 1],
    recurrence: "Monthly on the 15th",
    ...over,
  }) as unknown as Habit;

const task = (over: Partial<Task>): Task =>
  ({
    id: "t",
    title: "Water plants",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: "v1",
    date: "2999-01-02", // far future, a non-15th day → does not match the schedule
    time: null,
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...over,
  }) as Task;

function harness(authUid: string | null, habits: Habit[], tasks: Task[]) {
  let state = { authUid, habits, tasks };
  const get = () => state;
  const set = (patch: { habits: Habit[]; tasks?: Task[] }) => {
    state = { ...state, ...patch };
  };
  return { get, set, state: () => state };
}

describe("migrateData (pure)", () => {
  it("strips legacy fields and prunes only future-undone-non-detached mismatches", () => {
    const { habits, prunedTaskIds } = migrateData({
      habits: [legacyHabit()],
      tasks: [
        task({ id: "stale", status: "todo", detached: false }),
        task({ id: "done", status: "done", detached: false }),
        task({ id: "detached", status: "todo", detached: true }),
        task({ id: "match", date: "2999-01-15" }), // 15th → matches, kept
      ],
    });
    expect("days" in habits[0]).toBe(false);
    expect("recurrence" in habits[0]).toBe(false);
    expect(habits[0].schedule).toEqual({ type: "monthly", daysOfMonth: [15], lastDay: false });
    expect(prunedTaskIds).toEqual(["stale"]);
  });
});

describe("runDataMigrations (gated + idempotent)", () => {
  it("persists normalized habits, prunes stale instances, then no-ops on re-run", () => {
    vi.mocked(savePut).mockClear();
    vi.mocked(saveRemove).mockClear();
    const h = harness(
      "u-mig-1",
      [legacyHabit()],
      [task({ id: "stale" }), task({ id: "keep-done", status: "done" })],
    );

    runDataMigrations(h.get, h.set);

    expect(savePut).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePut).mock.calls[0]?.[0]).toBe("habits");
    expect(saveRemove).toHaveBeenCalledWith("tasks", "stale");
    expect(saveRemove).toHaveBeenCalledTimes(1);
    expect(h.state().tasks.map((t) => t.id)).toEqual(["keep-done"]);
    expect("days" in h.state().habits[0]).toBe(false);

    // Second run with the marker now at DATA_VERSION → fully idempotent.
    vi.mocked(savePut).mockClear();
    vi.mocked(saveRemove).mockClear();
    runDataMigrations(h.get, h.set);
    expect(savePut).not.toHaveBeenCalled();
    expect(saveRemove).not.toHaveBeenCalled();
    expect(DATA_VERSION).toBe(1);
  });
});
