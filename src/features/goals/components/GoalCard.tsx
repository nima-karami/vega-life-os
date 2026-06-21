/**
 * Goal card (vapor / HeroUI re-skin) shown nested under a value.
 * Renders status (text + icon + colour, never colour-only), headline progress,
 * timeframe, pace badge (hidden for closed goals), inline subgoal toggles, and a
 * row actions menu. Closed goals are de-emphasised; abandoned strikes the name.
 * All mutations go through unchanged store actions; display rules come from the
 * unit-tested presentation helpers.
 */
import { Checkbox } from "@heroui/react";
import { useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { cx, Icon, Menu, ProgressBar } from "@/core/ui";
import { GOAL_STATUS_LABEL, type GoalStatus, isGoalClosed } from "../model";
import { goalPaceBadge, goalProgressPercent } from "../presentation";
import { habitsForGoal } from "../selectors";
import { periodLabel } from "../timeframe";

const STATUS_ICON: Record<GoalStatus, IconName> = {
  backlog: "clock",
  active: "spark",
  paused: "clock",
  done: "check",
  abandoned: "close",
};

const STATUS_TONE: Record<GoalStatus, string> = {
  backlog: "border-[var(--color-line)] text-[var(--color-muted)]",
  active: "border-[var(--color-accent)] text-[var(--color-accent)]",
  paused: "border-[var(--color-line-strong)] text-[var(--color-muted)]",
  done: "border-[var(--color-good)] text-[var(--color-good)]",
  abandoned: "border-[var(--color-line)] text-[var(--color-muted)]",
};

export function GoalCard({
  goalId,
  isFirst,
  isLast,
  onEdit,
  onMove,
  onDelete,
  onStatusAnnounce,
}: {
  goalId: string;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  onStatusAnnounce: (msg: string) => void;
}) {
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId));
  const habits = useStore((s) => s.habits);
  const toggleSubgoal = useStore((s) => s.toggleSubgoal);
  const [announcedPct, setAnnouncedPct] = useState<number | null>(null);

  if (!goal) return null;

  const closed = isGoalClosed(goal.status);
  const pace = goalPaceBadge(goal);
  const pct = goalProgressPercent(goal);
  const linked = habitsForGoal(habits, goal.id);

  const onToggleSub = (subId: string) => {
    toggleSubgoal(goal.id, subId);
    // recompute after the toggle and announce the new derived percent
    const next = useStore.getState().goals.find((g) => g.id === goal.id);
    if (next) {
      const p = goalProgressPercent(next);
      if (p !== announcedPct) {
        setAnnouncedPct(p);
        onStatusAnnounce(`Progress ${p}%`);
      }
    }
  };

  return (
    <div
      className={cx(
        "rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5",
        closed && "opacity-[var(--closed-opacity,0.6)]",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit goal"
          className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <Icon name={goal.icon} size={15} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={cx(
            "min-w-0 flex-1 truncate text-left font-display text-[15px] font-medium text-[var(--color-ink)] hover:underline",
            goal.status === "abandoned" && "line-through",
          )}
        >
          {goal.name}
        </button>
        <span
          className={cx(
            "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
            STATUS_TONE[goal.status],
          )}
        >
          <Icon name={STATUS_ICON[goal.status]} size={10} />
          {GOAL_STATUS_LABEL[goal.status]}
        </span>
        <Menu
          align="end"
          trigger={
            <button
              type="button"
              aria-label="Goal actions"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
            >
              <Icon name="dots" size={15} />
            </button>
          }
          items={[
            { label: "Edit details", icon: "edit", onSelect: onEdit },
            { label: "Move up", icon: "chevU", disabled: isFirst, onSelect: () => onMove("up") },
            {
              label: "Move down",
              icon: "chevD",
              disabled: isLast,
              onSelect: () => onMove("down"),
            },
            { label: "Delete goal", icon: "trash", danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      <ProgressBar value={goal.progress} knob className="mt-3" />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 font-mono text-[10px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <Icon name="calendar" size={11} /> {periodLabel(goal.start, goal.end)}
        </button>
        <span className="font-mono text-[12px] tabular-nums text-[var(--color-muted)]">{pct}%</span>
        {pace && (
          <span
            className={cx(
              "ml-auto font-mono text-[10px]",
              pace.behind ? "text-[var(--color-accent)]" : "text-[var(--color-good)]",
            )}
          >
            {pace.text}
          </span>
        )}
      </div>

      {goal.subgoals.length > 0 && (
        <ul className="mt-3 space-y-1">
          {goal.subgoals.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <Checkbox
                size="sm"
                isSelected={s.done}
                onValueChange={() => onToggleSub(s.id)}
                aria-label={s.name}
                classNames={{
                  label: cx(
                    "font-sans text-[12px]",
                    s.done ? "text-[var(--color-muted)] line-through" : "text-[var(--color-ink)]",
                  ),
                }}
              >
                {s.name}
              </Checkbox>
            </li>
          ))}
        </ul>
      )}

      {linked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line)] pt-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Drives
          </span>
          {linked.map((h) => (
            <span
              key={h.id}
              className="rounded-full border border-[var(--color-line)] px-2 py-0.5 font-sans text-[11px] text-[var(--color-muted)]"
            >
              {h.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
