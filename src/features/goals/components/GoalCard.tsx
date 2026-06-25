/**
 * Goal card (calm HeroUI re-skin) shown nested under a value.
 * Renders status (text + icon + colour, never colour-only), headline progress,
 * timeframe, pace badge (hidden for closed goals), inline subgoal toggles, and a
 * row actions menu. Closed goals are de-emphasised; abandoned strikes the name.
 * All mutations go through unchanged store actions; display rules come from the
 * unit-tested presentation helpers.
 */
import { Checkbox, Chip, ProgressBar } from "@heroui/react";
import { useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { cx, Icon, Menu } from "@/core/ui";
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

/** HeroUI Chip color per status (calm semantic tones; never colour-only — icon + label too). */
const STATUS_COLOR: Record<GoalStatus, "default" | "accent" | "success"> = {
  backlog: "default",
  active: "accent",
  paused: "default",
  done: "success",
  abandoned: "default",
};

export function GoalCard({
  goalId,
  onEdit,
  onDelete,
  onStatusAnnounce,
}: {
  goalId: string;
  onEdit: () => void;
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
        "rounded-[12px] border border-border bg-surface-secondary/40 p-3.5",
        closed && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit goal"
          className="shrink-0 text-muted hover:text-foreground"
        >
          <Icon name={goal.icon} size={15} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={cx(
            "min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:underline",
            goal.status === "abandoned" && "line-through",
          )}
        >
          {goal.name}
        </button>
        <Chip
          size="sm"
          variant="soft"
          color={STATUS_COLOR[goal.status]}
          className="gap-1 rounded-full"
        >
          <Icon name={STATUS_ICON[goal.status]} size={11} />
          {GOAL_STATUS_LABEL[goal.status]}
        </Chip>
        <Menu
          align="end"
          isIconOnly
          triggerLabel="Goal actions"
          triggerContent={<Icon name="dots" size={15} />}
          items={[
            { label: "Edit details", icon: "edit", onSelect: onEdit },
            { label: "Delete goal", icon: "trash", danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      <ProgressBar aria-label="Progress" value={pct} className="mt-3">
        <ProgressBar.Track className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
          <ProgressBar.Fill className="h-full rounded-full bg-accent" />
        </ProgressBar.Track>
      </ProgressBar>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <Icon name="calendar" size={11} /> {periodLabel(goal.start, goal.end)}
        </button>
        <span className="text-xs tabular-nums text-muted">{pct}%</span>
        {pace && (
          <span className={cx("ml-auto text-xs", pace.behind ? "text-warning" : "text-success")}>
            {pace.text}
          </span>
        )}
      </div>

      {goal.subgoals.length > 0 && (
        <ul className="mt-3 space-y-1">
          {goal.subgoals.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <Checkbox isSelected={s.done} onChange={() => onToggleSub(s.id)} aria-label={s.name}>
                <Checkbox.Content className="flex items-center gap-2">
                  <Checkbox.Control>
                    <Checkbox.Indicator>
                      <Icon name="check" size={11} />
                    </Checkbox.Indicator>
                  </Checkbox.Control>
                  <span
                    className={cx(
                      "text-sm",
                      s.done ? "text-muted line-through" : "text-foreground",
                    )}
                  >
                    {s.name}
                  </span>
                </Checkbox.Content>
              </Checkbox>
            </li>
          ))}
        </ul>
      )}

      {linked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Drives</span>
          {linked.map((h) => (
            <Chip key={h.id} size="sm" variant="soft" className="rounded-full text-muted">
              {h.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
