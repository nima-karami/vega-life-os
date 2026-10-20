import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { BackToItLine } from "@/features/habits/BackToItLine";
import { useTaskLineage } from "@/features/tasks/lineage";
import type { Task } from "@/features/tasks/model";
import { getValueColor } from "@/features/values/color";

/** A single Daily-habits row — toggle, icon, title, value tag, and the back-to-it nudge. */
export function DailyHabitRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const habitDefs = useStore((s) => s.habits);
  const lineage = useTaskLineage(task.id);
  const isDone = task.status === "done";
  const habit = habitDefs.find((h) => h.id === task.habitId);
  const icon = habit?.icon ?? "repeat";

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={isDone}
        aria-label={isDone ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
        className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-surface-secondary"
      >
        <span
          className={cx(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
            isDone
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-transparent",
          )}
        >
          {isDone && <Icon name="check" size={12} />}
        </span>
        <Icon name={icon} size={15} className="shrink-0 text-muted" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cx(
              "truncate text-sm",
              isDone ? "text-muted line-through" : "text-foreground",
            )}
          >
            {task.title}
          </span>
          <BackToItLine task={task} />
        </span>
        {lineage?.value && (
          <span
            className="shrink-0 truncate text-xs font-medium"
            style={{ color: getValueColor(lineage.value) }}
          >
            {lineage.value.name}
          </span>
        )}
      </button>
    </li>
  );
}
