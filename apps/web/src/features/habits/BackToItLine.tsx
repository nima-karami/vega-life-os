import { useTodayISO } from "@/core/lib/clock";
import { useStore } from "@/core/store";
import type { Task } from "@/features/tasks/model";
import { shouldNudgeBackToIt } from "./back-to-it";

export function BackToItLine({ task }: { task: Task }) {
  if (task.habitId == null) return null;
  return <BackToItHabitLine task={task} habitId={task.habitId} />;
}

function BackToItHabitLine({ task, habitId }: { task: Task; habitId: string }) {
  const habit = useStore((s) => s.habits.find((h) => h.id === habitId));
  const tasks = useStore((s) => s.tasks);
  const today = useTodayISO();
  if (!shouldNudgeBackToIt(task, habit, tasks, today)) return null;
  return <span className="text-xs text-muted">Back to it today. Even a small version counts.</span>;
}
