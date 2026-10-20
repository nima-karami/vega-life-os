import { shiftISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { byTime } from "@/features/tasks/selectors";

export type CarryChoice = "tomorrow" | "let-go";
export type CarryChoices = Record<string, CarryChoice>;
export type CloseOutUpdate =
  | { id: string; kind: "move"; date: string }
  | { id: string; kind: "skip" };

const LOOKBACK_DAYS = 6;

export function listStillOpenTasks(tasks: Task[], today: string): Task[] {
  const floor = shiftISO(today, -LOOKBACK_DAYS);
  return tasks
    .filter(
      (t) =>
        t.kind === "oneoff" &&
        t.status === "todo" &&
        t.date != null &&
        t.date >= floor &&
        t.date <= today,
    )
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || byTime(a, b));
}

export function applyCloseOut(
  tasks: Task[],
  choices: CarryChoices,
  today: string,
): CloseOutUpdate[] {
  const tomorrow = shiftISO(today, 1);
  return listStillOpenTasks(tasks, today).flatMap((task): CloseOutUpdate[] => {
    const choice = choices[task.id];
    if (choice === "tomorrow") return [{ id: task.id, kind: "move", date: tomorrow }];
    if (choice === "let-go") return [{ id: task.id, kind: "skip" }];
    return [];
  });
}
