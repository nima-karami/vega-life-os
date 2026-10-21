import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import type { Task } from "@/features/tasks/model";
import { isHabitActive } from "./model";
import { hasLapsedPreviousSlot } from "./selectors";

export function BackToItLine({ task }: { task: Task }) {
  if (task.habitId == null) return null;
  return <BackToItHabitLine task={task} habitId={task.habitId} />;
}

function BackToItHabitLine({ task, habitId }: { task: Task; habitId: string }) {
  const habit = useStore((s) => s.habits.find((h) => h.id === habitId));
  const tasks = useStore((s) => s.tasks);
  if (!habit?.tracked || !isHabitActive(habit)) return null;
  if (task.date !== todayISO() || task.status !== "todo") return null;
  if (!hasLapsedPreviousSlot(tasks, habit)) return null;
  return <span className="text-xs text-muted">Back to it today. Even a small version counts.</span>;
}
