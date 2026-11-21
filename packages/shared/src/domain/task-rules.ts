import { format } from "date-fns";
import type { HabitShape } from "./build-habit";
import { findSlotOnOrBefore } from "./recurrence";

const nowLocalISO = () => format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

import type { TaskCreate as Task, TaskStatus } from "../entities/task";
import { fillDefaults } from "./defaults";
import { uid } from "./id";

/** Enforce the invariant: a task with no date can't carry a time. */
export function normalizeSchedule<T extends Pick<Task, "date" | "time">>(task: T): T {
  return task.date === null && task.time !== null ? { ...task, time: null } : task;
}

export function buildTask(patch: Partial<Task>, order: number, makeId = uid): Task {
  return normalizeSchedule(
    fillDefaults<Task>(patch, {
      id: makeId("t_"),
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
/**
 * Slot-integrity invariant: lock a habit instance to the slot it currently fills BEFORE any edit
 * can move its date, or a move frees the origin slot and the generator makes a phantom duplicate
 * (the phantom-duplicate bug). An explicit slotDate in the patch still wins.
 */
export function applyTaskPatch<T extends Task>(task: T, patch: Partial<Task>): T {
  const slotDate = task.habitId != null ? (task.slotDate ?? task.date) : task.slotDate;
  return normalizeSchedule({ ...task, slotDate, ...patch, id: task.id });
}

export function applyTaskStatus<T extends Task>(
  task: T,
  status: TaskStatus,
  nowLocal = nowLocalISO(),
): T {
  return {
    ...task,
    status,
    completedAt: status === "done" ? (task.completedAt ?? nowLocal) : null,
  };
}
export function unscheduleTask<T extends Task>(task: T): T {
  return applyTaskPatch(task, {
    date: null,
    time: null,
    status: task.status === "todo" ? "open" : task.status,
  });
}
export function unlinkTaskFromHabit<T extends Task>(task: T): T {
  return applyTaskPatch(task, { habitId: null, kind: "oneoff", slotDate: null, detached: false });
}
export function linkTaskToHabit<T extends Task>(task: T, habit: HabitShape): T {
  const slotDate = task.date ? (findSlotOnOrBefore(habit.schedule, task.date) ?? task.date) : null;
  return applyTaskPatch(task, {
    habitId: habit.id,
    kind: "habit",
    slotDate,
    valueId: habit.valueId,
    goalId: habit.goalId,
    detached: false,
  });
}
export function relinkTaskToHabit<T extends Task>(task: T, habit: HabitShape): T {
  return applyTaskPatch(task, {
    title: habit.name,
    time: habit.time,
    durationMin: habit.durationMin,
    goalId: habit.goalId,
    valueId: habit.valueId,
    detached: false,
  });
}
export function planTaskEdit<T extends Task>(
  task: T,
  patch: Partial<Task>,
  habits: HabitShape[],
  nowLocal = nowLocalISO(),
): T {
  if (patch.date === null) return unscheduleTask(task);
  if (patch.habitId !== undefined) {
    if (patch.habitId === null) return unlinkTaskFromHabit(task);
    const habit = habits.find((row) => row.id === patch.habitId);
    if (!habit) return task;
    return linkTaskToHabit(task, habit);
  }
  if (patch.detached === false && task.detached && task.kind === "habit" && task.habitId) {
    const habit = habits.find((row) => row.id === task.habitId);
    return habit ? relinkTaskToHabit(task, habit) : task;
  }
  if (patch.status !== undefined) return applyTaskStatus(task, patch.status, nowLocal);
  return applyTaskPatch(task, patch);
}
