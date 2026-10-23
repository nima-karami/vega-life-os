import { addDays, format } from "date-fns";
import { saveBulkPut, saveBulkRemove } from "@/core/store/persist";
import type { RootState } from "@/core/store/types";
import { buildTask } from "./build-task";
import { buildMissingInstances, findStaleInstances, getGeneratingHabits } from "./habit-instances";
import type { Task } from "./model";

/** A task the store has already dropped; `prior` is what a rejected delete puts back. */
interface TaskRemoval {
  id: string;
  prior?: Task;
}

/** What one pass over the habit runway changes, and the task list it leaves. */
interface UpcomingPlan {
  stale: Task[];
  created: Task[];
  tasks: Task[];
}

/** Numbered as if each were added on its own onto the end of the list. */
export function buildInstances(patches: Partial<Task>[], baseOrder: number): Task[] {
  return patches.map((patch, index) => buildTask(patch, baseOrder + index));
}

/** Drop stale habit instances and generate the missing ones from today through `daysAhead`. */
export function planUpcoming(
  state: Pick<RootState, "tasks" | "habits" | "values">,
  daysAhead = 14,
  start = new Date(),
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
  const created = buildInstances(buildMissingInstances(kept, generating, isoDates), kept.length);
  return { stale, created, tasks: created.length ? [...kept, ...created] : kept };
}

/** Persist task deletes and instance inserts the store already shows, one bulk call each. */
export function saveTaskChurn(removed: TaskRemoval[], created: Task[]): void {
  if (removed.length)
    void saveBulkRemove(
      "tasks",
      removed.map((removal) => removal.id),
      removed.map((removal) => removal.prior),
    );
  if (created.length)
    void saveBulkPut(
      "tasks",
      created,
      created.map(() => ({ kind: "insert" as const })),
    );
}
