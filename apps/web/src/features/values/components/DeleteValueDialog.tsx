import { useStore } from "@/core/store";
import { ConfirmDialog } from "@/core/ui";
import { countCascade, formatCascadeMessage } from "../cascade";
import type { Value } from "../model";

/** Deleting a value takes its goals, habits and their tasks with it — the confirm
 *  always names what goes. */
export function DeleteValueDialog({
  value,
  onClose,
  onDeleted,
}: {
  value: Value | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const removeValue = useStore((s) => s.removeValue);
  const pushToast = useStore((s) => s.pushToast);

  const cascade = value ? countCascade(value.id, { goals, habits }) : { goals: 0, habits: 0 };

  return (
    <ConfirmDialog
      open={!!value}
      danger
      title={`Delete "${value?.name}"?`}
      confirmLabel="Delete"
      body={formatCascadeMessage(cascade) ?? "This can't be undone."}
      onConfirm={() => {
        if (value) {
          removeValue(value.id);
          pushToast("Value deleted");
        }
        onClose();
        onDeleted();
      }}
      onClose={onClose}
    />
  );
}
