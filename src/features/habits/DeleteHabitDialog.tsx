import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useStore } from "@/core/store";
import type { Habit } from "./model";
import { habitInstances } from "./selectors";

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

  const instanceCount = habitInstances(tasks, habit.id).length;

  const onConfirm = () => {
    removeHabit(habit.id);
    pushToast("Habit deleted");
    onClose();
    onDeleted();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      role="alertdialog"
      backdrop="blur"
      size="sm"
    >
      <ModalContent>
        <ModalHeader className="text-base font-semibold">Delete “{habit.name}”?</ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">
            This removes it
            {instanceCount > 0
              ? ` and its ${instanceCount} scheduled task${instanceCount === 1 ? "" : "s"}.`
              : " and its scheduled tasks."}{" "}
            This can&apos;t be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          {/* Cancel gets initial focus (safer default for a destructive dialog). */}
          <Button variant="light" onPress={onClose} autoFocus>
            Cancel
          </Button>
          <Button color="danger" onPress={onConfirm}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
