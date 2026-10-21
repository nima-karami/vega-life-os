import { useStore } from "@/core/store";
import type { Habit, HabitLifecycle } from "./model";

/** Move a habit between Active / Paused / Archived. Applies immediately — the
 *  transitions carry side effects (instance regeneration, the resume anchor)
 *  a buffered draft would lose. */
export function useHabitLifecycle(habit: Habit, lifecycle: HabitLifecycle) {
  const archiveHabit = useStore((s) => s.archiveHabit);
  const unarchiveHabit = useStore((s) => s.unarchiveHabit);
  const pauseHabit = useStore((s) => s.pauseHabit);
  const resumeHabit = useStore((s) => s.resumeHabit);
  const pushToast = useStore((s) => s.pushToast);

  return (target: HabitLifecycle) => {
    if (target === lifecycle) return;
    // Unarchive first so paused/active transitions run from a live (active) habit.
    if (lifecycle === "archived") unarchiveHabit(habit.id);
    if (target === "paused") {
      pauseHabit(habit.id);
      pushToast("Habit paused");
    } else if (target === "archived") {
      archiveHabit(habit.id);
      pushToast("Habit archived");
    } else if (lifecycle === "paused") {
      resumeHabit(habit.id);
      pushToast("Habit resumed");
    } else {
      pushToast("Habit unarchived");
    }
  };
}
