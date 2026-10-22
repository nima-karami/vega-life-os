import { TimePicker } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { DROP_DURATION } from "../geometry";
import { formatTaskDaySubtitle } from "../task-labels";
import { PickerModal } from "./PickerModal";

/** "Schedule to time…": give an all-day chip a time without dragging. */
export function ScheduleTimeModal({
  task,
  onPick,
  onClose,
}: {
  task: Task | null;
  onPick: (time: string | null) => void;
  onClose: () => void;
}) {
  return (
    <PickerModal
      isOpen={!!task}
      label="Schedule to a time"
      title="Schedule to a time"
      subtitle={formatTaskDaySubtitle(task)}
      onClose={onClose}
    >
      <p className="text-sm text-muted">
        Pick a start time. It becomes a {DROP_DURATION}-minute block.
      </p>
      <TimePicker label="time" value={task?.time ?? "09:00"} clearable={false} onChange={onPick} />
    </PickerModal>
  );
}
