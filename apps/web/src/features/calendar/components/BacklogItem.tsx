import { Button } from "@heroui/react";
import { Icon } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";

export function BacklogItem({
  task,
  onOpen,
  onSchedule,
}: {
  task: Task;
  onOpen: () => void;
  onSchedule: () => void;
}) {
  const accent = useValueColor(task.valueId);
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${task.title}, unscheduled`}
        className="flex flex-1 items-center gap-2 truncate rounded-[12px] border border-border bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-accent"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="truncate text-sm text-foreground">{task.title}</span>
      </button>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={onSchedule}
        aria-label={`Schedule ${task.title} for today`}
        className="shrink-0 text-muted"
      >
        <Icon name="calendar" size={14} />
      </Button>
    </li>
  );
}
