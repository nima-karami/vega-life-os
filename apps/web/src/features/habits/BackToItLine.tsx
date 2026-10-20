import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import type { Task } from "@/features/tasks/model";
import { isHabitActive } from "./model";
import { hasLapsedPreviousSlot } from "./selectors";

export function BackToItLine({ task }: { task: Task }) {
  const habit = useStore((s) =>
    task.habitId == null ? undefined : s.habits.find((h) => h.id === task.habitId),
  );
  const tasks = useStore((s) => s.tasks);
  if (!habit || !isHabitActive(habit)) return null;
  if (task.date !== todayISO() || task.status !== "todo") return null;
  if (!hasLapsedPreviousSlot(tasks, habit)) return null;
  return (
    <span className="text-xs text-muted">Back to it today — even a small version counts.</span>
  );
}
