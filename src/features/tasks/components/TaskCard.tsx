import { cx, Icon, Lineage, Menu, type MenuItem, valueStripeStyle } from "@/core/ui";
import { useTaskLineage } from "@/features/tasks/lineage";
import { ENERGY_META, type Task } from "../model";
import { energyOf } from "../selectors";

/**
 * TaskCard — the vapor Today-view card.
 *
 * Composition: a value-colored leading stripe, a binary done-toggle control,
 * the title, the lineage row (value name · → goal · Habit pill), and the
 * optional time + energy glyph metadata. Resolved tasks (done/skip) are
 * visually de-emphasised. A hover/keyboard overflow menu provides the
 * non-pointer paths for skip, reorder, and delete.
 */
export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onMoveUp: (t: Task) => void;
  onMoveDown: (t: Task) => void;
  onDelete: (t: Task) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const lineage = useTaskLineage(task.id);
  const done = task.status === "done";
  const skipped = task.status === "skip";
  const resolved = done || skipped;
  const energy = energyOf(task);

  const checkLabel = done ? `Mark ${task.title} not done` : `Mark ${task.title} done`;

  const menuItems: MenuItem[] = [
    skipped
      ? { label: "Unskip", icon: "check", onSelect: () => onUnskip(task) }
      : { label: "Skip", icon: "skip", onSelect: () => onSkip(task) },
    ...(!resolved
      ? [
          {
            label: "Move up",
            icon: "chevU" as const,
            onSelect: () => onMoveUp(task),
            disabled: !canMoveUp,
          },
          {
            label: "Move down",
            icon: "chevD" as const,
            onSelect: () => onMoveDown(task),
            disabled: !canMoveDown,
          },
        ]
      : []),
    { label: "Edit", icon: "edit", onSelect: () => onOpen(task) },
    { label: "Delete", icon: "trash", danger: true, onSelect: () => onDelete(task) },
  ];

  return (
    <div
      className={cx(
        "group relative flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] py-3 pe-3 ps-4 shadow-[var(--shadow-soft)] transition-all duration-150",
        resolved ? "opacity-60" : "hover:border-[var(--color-accent)]/40",
      )}
      style={valueStripeStyle(lineage ?? { fromHabit: false })}
    >
      {/* Done toggle — role=checkbox so SR exposes checked state */}
      <button
        type="button"
        aria-pressed={done}
        aria-label={checkLabel}
        onClick={() => onToggleDone(task)}
        className={cx(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
          done
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
            : skipped
              ? "border-[var(--color-line-strong)] text-[var(--color-muted)]"
              : "border-[var(--color-line-strong)] text-transparent hover:border-[var(--color-accent)]",
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
              "min-w-0 truncate font-sans text-[15px] text-[var(--color-ink)]",
              done && "line-through decoration-1",
            )}
          >
            {task.title}
          </span>
          {skipped && (
            <span className="shrink-0 rounded-full bg-[var(--color-line)] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[var(--color-muted)]">
              Skipped
            </span>
          )}
        </span>

        <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
          {lineage && <Lineage lineage={lineage} variant="card" />}
          {task.time && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
              <Icon name="clock" size={11} />
              {task.time}
            </span>
          )}
          {energy !== "neutral" && (
            <span
              className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[var(--color-muted)]"
              title={ENERGY_META[energy].label}
            >
              <span aria-hidden="true">{ENERGY_META[energy].glyph}</span>
              <span className="sr-only">{ENERGY_META[energy].label}</span>
            </span>
          )}
          {task.detached && (
            <Icon
              name="unlink"
              size={12}
              className="text-[var(--color-muted)]"
              aria-label="Detached from habit"
            />
          )}
        </span>
      </button>

      {/* Overflow menu — keyboard path for skip / reorder / delete */}
      <Menu
        trigger={
          <button
            type="button"
            aria-label={`Actions for ${task.title}`}
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-muted)] opacity-0 transition-opacity hover:bg-[var(--color-canvas)] focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Icon name="dots" size={16} />
          </button>
        }
        items={menuItems}
      />
    </div>
  );
}
