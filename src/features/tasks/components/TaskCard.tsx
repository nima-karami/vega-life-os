import { Card } from "@heroui/react";
import { useStore } from "@/core/store";
import { cx, Icon, Lineage, Menu, type MenuItem, StreakBadge, valueStripeStyle } from "@/core/ui";
import { habitStreak } from "@/features/habits";
import { useTaskLineage } from "@/features/tasks/lineage";
import type { Task } from "../model";

/**
 * TaskCard — the Today-view card.
 *
 * Composition: a value-colored leading stripe, a binary done-toggle control,
 * the title, the lineage row (value name · → goal · Habit pill), and the
 * optional time metadata. Resolved tasks (done/skip) are visually
 * de-emphasised. A hover/keyboard overflow menu provides the non-pointer paths
 * for skip and delete. (Reorder handle, for Remaining rows, is owned by SortableList.)
 */
export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const lineage = useTaskLineage(task.id);
  const tasks = useStore((s) => s.tasks);
  const streak = task.habitId != null ? habitStreak(tasks, task.habitId) : 0;
  const done = task.status === "done";
  const skipped = task.status === "skip";
  const resolved = done || skipped;

  const checkLabel = done ? `Mark ${task.title} not done` : `Mark ${task.title} done`;

  const menuItems: MenuItem[] = [
    skipped
      ? { label: "Unskip", icon: "check", onSelect: () => onUnskip(task) }
      : { label: "Skip", icon: "skip", onSelect: () => onSkip(task) },
    { label: "Edit", icon: "edit", onSelect: () => onOpen(task) },
    { label: "Delete", icon: "trash", danger: true, onSelect: () => onDelete(task) },
  ];

  return (
    <Card
      className={cx(
        "group relative flex flex-row items-start gap-3 rounded-[16px] border border-border bg-surface py-3 pe-3 ps-4",
        resolved && "opacity-60",
      )}
      style={valueStripeStyle(lineage ?? { fromHabit: false })}
    >
      {/* Done toggle — aria-pressed toggle button so SR exposes the on/off state */}
      <button
        type="button"
        aria-pressed={done}
        aria-label={checkLabel}
        onClick={() => onToggleDone(task)}
        className={cx(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
          done
            ? "border-accent bg-accent text-accent-foreground"
            : skipped
              ? "border-border text-muted"
              : "border-border text-transparent hover:border-accent",
        )}
      >
        {done && <Icon name="check" size={12} />}
        {skipped && <Icon name="skip" size={12} />}
      </button>

      {/* Body — clicking opens the editor */}
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
      >
        <span className="flex w-full items-center gap-2">
          <span
            className={cx(
              "min-w-0 truncate text-sm text-foreground",
              done && "line-through decoration-1",
            )}
          >
            {task.title}
          </span>
          {skipped && (
            <span className="shrink-0 rounded-full bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-muted">
              Skipped
            </span>
          )}
        </span>

        <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
          {lineage && <Lineage lineage={lineage} variant="card" />}
          {task.time && (
            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted">
              <Icon name="clock" size={11} />
              {task.time}
            </span>
          )}
          <StreakBadge streak={streak} />
          {task.detached && (
            <Icon name="unlink" size={12} className="text-muted" aria-label="Detached from habit" />
          )}
        </span>
      </button>

      {/* Overflow menu — keyboard path for skip / reorder / delete */}
      <Menu
        trigger={
          <button
            type="button"
            aria-label={`Actions for ${task.title}`}
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[12px] text-muted opacity-0 transition-opacity hover:bg-surface-secondary focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Icon name="dots" size={16} />
          </button>
        }
        items={menuItems}
      />
    </Card>
  );
}
