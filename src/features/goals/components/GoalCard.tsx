/**
 * Goal card (calm HeroUI re-skin) shown nested under a value.
 * Renders status (text + icon + colour, never colour-only), headline progress,
 * timeframe, pace badge (hidden for closed goals), inline subgoal toggles, and a
 * row actions menu. Closed goals are de-emphasised; abandoned strikes the name.
 * All mutations go through unchanged store actions; display rules come from the
 * unit-tested presentation helpers.
 */
import { Checkbox, Chip, Progress } from "@heroui/react";
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
const STATUS_COLOR: Record<GoalStatus, "default" | "primary" | "success"> = {
  backlog: "default",
  active: "primary",
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
        "rounded-medium border border-divider bg-content2/40 p-3.5",
        closed && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit goal"
          className="shrink-0 text-default-400 hover:text-foreground"
        >
          <Icon name={goal.icon} size={15} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={cx(
            "min-w-0 flex-1 truncate text-left text-small font-medium text-foreground hover:underline",
            goal.status === "abandoned" && "line-through",
          )}
        >
          {goal.name}
        </button>
        <Chip
          size="sm"
          variant="flat"
          color={STATUS_COLOR[goal.status]}
          startContent={<Icon name={STATUS_ICON[goal.status]} size={11} className="ml-0.5" />}
        >
          {GOAL_STATUS_LABEL[goal.status]}
        </Chip>
        <Menu
          align="end"
          trigger={
            <button
              type="button"
              aria-label="Goal actions"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-medium text-default-400 hover:bg-content3 hover:text-foreground"
            >
              <Icon name="dots" size={15} />
            </button>
          }
          items={[
            { label: "Edit details", icon: "edit", onSelect: onEdit },
            { label: "Delete goal", icon: "trash", danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      <Progress
        aria-label="Progress"
        size="sm"
        radius="full"
        color="primary"
        value={pct}
        className="mt-3"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-tiny text-default-500 hover:text-foreground"
        >
          <Icon name="calendar" size={11} /> {periodLabel(goal.start, goal.end)}
        </button>
        <span className="text-tiny tabular-nums text-default-500">{pct}%</span>
        {pace && (
          <span className={cx("ml-auto text-tiny", pace.behind ? "text-warning" : "text-success")}>
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
                    "text-small",
                    s.done ? "text-default-500 line-through" : "text-foreground",
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-tiny text-default-400">Drives</span>
          {linked.map((h) => (
            <Chip key={h.id} size="sm" variant="flat" className="text-default-500">
              {h.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
