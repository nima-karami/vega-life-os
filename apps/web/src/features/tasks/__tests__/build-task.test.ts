import { describe, expect, it } from "vitest";
import { buildTask, normalizeSchedule } from "../build-task";
import type { Task } from "../model";

describe("buildTask", () => {
  it("builds an unscheduled one-off as an open inbox task", () => {
    const task = buildTask({}, 4);
    expect(task).toMatchObject({
      title: "New task",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: null,
      date: null,
      slotDate: null,
      completedAt: null,
      time: null,
      durationMin: 30,
      status: "open",
      detached: false,
      note: "",
      order: 4,
    });
    expect(task.id).toMatch(/^t_/);
  });

  it("starts a scheduled task as todo", () => {
    expect(buildTask({ date: "2026-10-21" }, 0).status).toBe("todo");
  });

  it("anchors a habit instance's slot to its date", () => {
    expect(buildTask({ habitId: "h1", date: "2026-10-21" }, 0).slotDate).toBe("2026-10-21");
    expect(buildTask({ habitId: "h1" }, 0).slotDate).toBeNull();
  });

  it("keeps an explicit slotDate, status and order", () => {
    const task = buildTask(
      { habitId: "h1", date: "2026-10-22", slotDate: "2026-10-21", status: "done", order: 9 },
      0,
    );
    expect(task).toMatchObject({ slotDate: "2026-10-21", status: "done", order: 9 });
  });

  it("drops a time from an undated task", () => {
    expect(buildTask({ time: "09:00" }, 0).time).toBeNull();
  });

  it("drops fields a task builder doesn't set", () => {
    const patch = { title: "x", energy: "charge" } as Partial<Task>;
    expect(buildTask(patch, 0)).not.toHaveProperty("energy");
  });
});

describe("normalizeSchedule", () => {
  it("clears the time only when there is no date", () => {
    const dated = buildTask({ date: "2026-10-21", time: "09:00" }, 0);
    expect(normalizeSchedule(dated)).toBe(dated);
    expect(normalizeSchedule({ ...dated, date: null }).time).toBeNull();
  });
});
