import { addDays, format } from "date-fns";
import type { TaskCreate as Task } from "../entities/task";
import type { HabitShape } from "./build-habit";
import { buildMissingInstances, findStaleInstances, getGeneratingHabits } from "./habit-instances";
import { uid } from "./id";
import { buildTask } from "./task-rules";

/** What one pass over the habit runway changes, and the task list it leaves. */
interface UpcomingPlan {
  stale: Task[];
  created: Task[];
  tasks: Task[];
}

/** Numbered as if each were added on its own onto the end of the list. */
export function buildInstances(patches: Partial<Task>[], baseOrder: number, makeId = uid): Task[] {
  return patches.map((patch, index) => buildTask(patch, baseOrder + index, makeId));
}

/** Drop stale habit instances and generate the missing ones from today through `daysAhead`. */
export function planUpcoming(
  state: {
    tasks: Task[];
    habits: HabitShape[];
    values: { id: string; archivedAt?: string | null }[];
  },
  daysAhead = 14,
  start = new Date(),
  makeId = uid,
): UpcomingPlan {
  const generating = getGeneratingHabits(state.habits, state.values);
  const today = format(start, "yyyy-MM-dd");
  const end = format(addDays(start, daysAhead), "yyyy-MM-dd");

  const stale = findStaleInstances(state.tasks, generating, today, end);
  const drop = new Set(stale.map((t) => t.id));
  const kept = stale.length ? state.tasks.filter((t) => !drop.has(t.id)) : state.tasks;

  const isoDates = Array.from({ length: Math.max(daysAhead + 1, 0) }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
  const created = buildInstances(
    buildMissingInstances(kept, generating, isoDates),
    kept.length,
    makeId,
  );
  return { stale, created, tasks: created.length ? [...kept, ...created] : kept };
}
