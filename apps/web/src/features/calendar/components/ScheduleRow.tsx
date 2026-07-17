import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";

export function ScheduleRow({ task, onPick }: { task: Task; onPick: () => void }) {
  const accent = useValueColor(task.valueId);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <span className="truncate text-sm text-foreground">{task.title}</span>
    </button>
  );
}
