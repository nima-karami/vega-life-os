import { Button, ButtonGroup } from "@heroui/react";
import { formatShortDate, type WeekDay } from "@/core/lib/date";
import { cx } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { formatTaskDaySubtitle } from "../task-labels";
import { PickerModal } from "./PickerModal";

/** "Move to day…": change an all-day chip's day without dragging. */
export function MoveToDayModal({
  task,
  days,
  onPick,
  onClose,
}: {
  task: Task | null;
  days: WeekDay[];
  onPick: (dayIso: string) => void;
  onClose: () => void;
}) {
  return (
    <PickerModal
      isOpen={!!task}
      label="Move to a day"
      title="Move to a day"
      subtitle={formatTaskDaySubtitle(task)}
      onClose={onClose}
    >
      <p className="text-sm text-muted">
        Pick a day this week. It stays an all-day item, with no time assigned.
      </p>
      <ButtonGroup fullWidth>
        {days.map((d) => (
          <Button
            key={d.iso}
            size="sm"
            aria-label={`${d.dow}, ${formatShortDate(d.iso)}${d.today ? ", today" : ""}`}
            aria-pressed={task?.date === d.iso}
            variant={task?.date === d.iso ? "primary" : "outline"}
            className={cx("flex-col gap-0 px-1 py-1.5", d.today && "ring-1 ring-accent")}
            onPress={() => onPick(d.iso)}
          >
            <span className="text-[10px] leading-none opacity-70">{d.dow}</span>
            <span className="text-sm font-semibold leading-none tabular-nums">
              {String(d.dom).padStart(2, "0")}
            </span>
          </Button>
        ))}
      </ButtonGroup>
    </PickerModal>
  );
}
