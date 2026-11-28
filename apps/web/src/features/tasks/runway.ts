import { saveBulkPut, saveBulkRemove } from "@/core/store/persist";
import type { Task } from "./model";

/** A task the store has already dropped; `prior` is what a rejected delete puts back. */
interface TaskRemoval {
  id: string;
  prior?: Task;
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
