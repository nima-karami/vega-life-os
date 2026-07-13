import { useStore } from "@/core/store";
import { ConfirmDialog } from "@/core/ui";
import type { Habit } from "./model";
import { getHabitInstances } from "./selectors";

export interface DeleteHabitDialogProps {
  habit: Habit;
  isOpen: boolean;
  onClose: () => void;
  /** Called after the habit is removed (e.g. to close the editor / restore focus). */
  onDeleted: () => void;
}

/**
 * Custom HeroUI confirmation — never a native confirm(). Confirming cascades
 * (removeHabit deletes the habit and all its task instances).
 */
export function DeleteHabitDialog({ habit, isOpen, onClose, onDeleted }: DeleteHabitDialogProps) {
  const tasks = useStore((s) => s.tasks);
  const removeHabit = useStore((s) => s.removeHabit);
  const pushToast = useStore((s) => s.pushToast);

  const instanceCount = getHabitInstances(tasks, habit.id).length;

  const onConfirm = () => {
    removeHabit(habit.id);
    pushToast("Habit deleted");
    onClose();
    onDeleted();
  };

  const detail =
    instanceCount > 0
      ? `This removes it and its ${instanceCount} scheduled task${instanceCount === 1 ? "" : "s"}. This can't be undone.`
      : "This removes it and its scheduled tasks. This can't be undone.";

  return (
    <ConfirmDialog
      open={isOpen}
      title={`Delete “${habit.name}”?`}
      body={detail}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      danger
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
