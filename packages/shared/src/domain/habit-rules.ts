import type { TaskCreate as Task } from "../entities/task";
import type { HabitShape } from "./build-habit";
import { localDayOf, todayISO } from "./date";
import { habitLifecycle } from "./habit-lifecycle";
import { closeOpenPause } from "./paused-spans";
/** future, undone, non-detached habit instances — the set a schedule change or
 *  archive rebuilds/strips. Past and user-customized instances are left alone. */
export function findFutureUndoneInstanceIds(
  tasks: Task[],
  habitId: string,
  today = todayISO(),
): string[] {
  return tasks
    .filter(
      (t) =>
        t.habitId === habitId && t.date && t.date >= today && t.status === "todo" && !t.detached,
    )
    .map((t) => t.id);
}

export function applyHabitTransition<H extends HabitShape>(
  habit: H,
  state: "pause" | "resume" | "archive" | "unarchive",
  tasks: Task[],
  now = { today: todayISO(), nowIso: new Date().toISOString(), dayOf: localDayOf },
): { habit: H; removeTaskIds: string[]; shouldRegenerate: boolean } {
  const lifecycle = habitLifecycle(habit);
  const unchanged = { habit, removeTaskIds: [], shouldRegenerate: false };
  if (state === "unarchive")
    return lifecycle === "archived"
      ? { ...unchanged, habit: { ...habit, archivedAt: null }, shouldRegenerate: true }
      : unchanged;
  if (state === "resume")
    return lifecycle === "paused"
      ? {
          ...unchanged,
          habit: {
            ...habit,
            pausedAt: null,
            resumedAt: now.nowIso,
            pausedSpans: closeOpenPause(habit, tasks, now.today, now.dayOf),
          },
          shouldRegenerate: true,
        }
      : unchanged;
  if (lifecycle === "archived" || (state === "pause" && lifecycle !== "active")) return unchanged;
  const change =
    state === "pause"
      ? { pausedAt: now.nowIso }
      : {
          archivedAt: now.nowIso,
          pausedAt: null,
          pausedSpans: closeOpenPause(habit, tasks, now.today, now.dayOf),
        };
  return {
    habit: { ...habit, ...change },
    removeTaskIds: findFutureUndoneInstanceIds(tasks, habit.id, now.today),
    shouldRegenerate: false,
  };
}
