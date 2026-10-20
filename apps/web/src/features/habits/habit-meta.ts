import type { CardMeta } from "@/core/ui";
import type { Task } from "@/features/tasks/model";
import type { Habit } from "./model";
import { describeRecurrence } from "./recurrence";
import { computeHabitConsistency } from "./selectors";

export function buildHabitMeta(tasks: Task[], habit: Habit): CardMeta[] {
  const meta: CardMeta[] = [{ text: describeRecurrence(habit.schedule) }];
  meta.push({
    text: habit.time
      ? `${habit.time} · ${habit.durationMin} min`
      : `Anytime · ${habit.durationMin} min`,
  });
  const { kept, due } = computeHabitConsistency(tasks, habit);
  if (due > 0) meta.push({ text: `${kept} of last ${due}`, live: true });
  return meta;
}
