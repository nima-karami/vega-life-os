import { formatShortDate } from "@/core/lib/date";
import type { Task } from "@/features/tasks";
import { PickerModal } from "./PickerModal";
import { ScheduleRow } from "./ScheduleRow";

/** Schedule-existing-task picker, opened from the empty-slot menu. */
export function ScheduleSlotModal({
  slot,
  backlog,
  onPick,
  onClose,
}: {
  slot: { date: string; time: string } | null;
  backlog: Task[];
  onPick: (task: Task) => void;
  onClose: () => void;
}) {
  return (
    <PickerModal
      isOpen={!!slot}
      label="Schedule an existing task"
      title="Schedule a task"
      subtitle={slot && `${formatShortDate(slot.date)} · ${slot.time}`}
      onClose={onClose}
    >
      {backlog.length === 0 ? (
        <p className="text-sm text-muted">No unscheduled tasks.</p>
      ) : (
        <ul className="space-y-1.5">
          {backlog.map((t) => (
            <li key={t.id}>
              <ScheduleRow task={t} onPick={() => onPick(t)} />
            </li>
          ))}
        </ul>
      )}
    </PickerModal>
  );
}
