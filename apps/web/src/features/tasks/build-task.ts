import { fillDefaults } from "@/core/lib/defaults";
import { uid } from "@/core/lib/id";
import type { Task } from "./model";

/** Enforce the invariant: a task with no date can't carry a time. */
export function normalizeSchedule(task: Task): Task {
  return task.date === null && task.time !== null ? { ...task, time: null } : task;
}

export function buildTask(patch: Partial<Task>, order: number): Task {
  return normalizeSchedule(
    fillDefaults<Task>(patch, {
      id: uid("t_"),
      title: "New task",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: null,
      date: null,
      // habit instances anchor to the slot they're generated for; one-offs have none
      slotDate: patch.habitId ? (patch.date ?? null) : null,
      completedAt: null,
      time: null,
      durationMin: 30,
      // unscheduled tasks start "open" (inbox); scheduled ones start "todo"
      status: patch.date ? "todo" : "open",
      detached: false,
      note: "",
      order,
    }),
  );
}
