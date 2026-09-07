import { Card } from "@heroui/react";
import { shiftISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  cx,
  getValueStripeStyle,
  Icon,
  Lineage,
  Menu,
  type MenuItem,
  ROW_META_CLASS,
  StreakBadge,
} from "@/core/ui";
import { getStreakState } from "@/features/habits";
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
  const habits = useStore((s) => s.habits);
  const rules = useStore((s) => s.streakRules);
  const habit = task.habitId != null ? habits.find((h) => h.id === task.habitId) : undefined;
  const streak = habit ? getStreakState(tasks, habit, undefined, rules) : null;
  const done = task.status === "done";
  const skipped = task.status === "skip";
  const isResolved = done || skipped;
  // a completion logged after the slot's grace window counts for the rate, not the streak
  const isLoggedLate =
    done && task.completedAt != null && task.slotDate != null
      ? task.completedAt.slice(0, 10) > shiftISO(task.slotDate, rules.graceDays)
      : false;

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
        isResolved && "opacity-60",
      )}
      style={getValueStripeStyle(lineage ?? { fromHabit: false })}
    >
      {/* aria-pressed toggle so SR exposes the on/off state */}
      <button
        type="button"
        aria-pressed={done}
        aria-label={checkLabel}
        onClick={() => onToggleDone(task)}
        className="-mt-2.5 -mb-3 -ms-3 -me-3 grid h-11 w-11 shrink-0 place-items-center sm:mt-0.5 sm:mb-0 sm:ms-0 sm:me-0 sm:h-5 sm:w-5"
      >
        <span
          className={cx(
            "grid h-5 w-5 place-items-center rounded-full border transition-colors",
            done
              ? "border-accent bg-accent text-accent-foreground"
              : skipped
                ? "border-border text-muted"
                : "border-border text-transparent hover:border-accent",
          )}
        >
          {done && <Icon name="check" size={12} />}
          {skipped && <Icon name="skip" size={12} />}
        </span>
      </button>

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

        <span className={ROW_META_CLASS}>
          {lineage && <Lineage lineage={lineage} variant="card" />}
          {task.time && (
            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted">
              <Icon name="clock" size={11} />
              {task.time}
            </span>
          )}
          <StreakBadge
            streak={streak?.count ?? 0}
            state={streak?.state === "healing" ? "healing" : "solid"}
            recovery={streak?.recovery}
          />
          {isLoggedLate && (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted"
              title="Logged after its day — counts toward your rate, not the streak"
            >
              <Icon name="clock" size={11} />
              Late
            </span>
          )}
          {task.detached && (
            <Icon name="unlink" size={12} className="text-muted" aria-label="Detached from habit" />
          )}
        </span>
      </button>

      <Menu
        isIconOnly
        touchTarget
        triggerLabel={`Actions for ${task.title}`}
        triggerClassName="-mt-1 -mb-1.5 -ms-1.5 -me-1.5 shrink-0 transition-opacity sm:mt-0.5 sm:mb-0 sm:ms-0 sm:me-0 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
        triggerContent={<Icon name="dots" size={16} />}
        items={menuItems}
      />
    </Card>
  );
}
