import { Link } from "react-router";
import { cx, Icon } from "@/core/ui";
import { buildGoalMeta } from "@/features/goals/components/GoalEntityCard";
import {
  GOAL_STATUS_ICON,
  GOAL_STATUS_LABEL,
  type Goal,
  isGoalClosed,
} from "@/features/goals/model";

/** A goal as it reads inside its value's card: no disc, a hairline rule for the measure.
 *  Loosened rather than shrunk on a phone — more air where there is no room to rest. */
export function ValueGoalRow({ goal }: { goal: Goal }) {
  const closed = isGoalClosed(goal.status);
  return (
    <Link
      to={`/goals/${goal.id}`}
      className={cx(
        "flex items-start gap-3 py-4 outline-none sm:py-3",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-0",
        goal.status === "paused" && "opacity-80",
        goal.status === "abandoned" && "opacity-60",
      )}
    >
      <span className="mt-px shrink-0 text-white/[.86]">
        <Icon name={goal.icon} size={15} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[11px] sm:gap-[7px]">
        <span className="flex items-center gap-2">
          <span
            className={cx(
              "min-w-0 flex-1 truncate text-sm font-medium text-white",
              closed && "line-through",
            )}
          >
            {goal.name}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-[9px] py-[3px] text-[12px] text-white">
            <Icon name={GOAL_STATUS_ICON[goal.status]} size={11} />
            {GOAL_STATUS_LABEL[goal.status]}
          </span>
        </span>
        <span className="block h-1 overflow-hidden rounded-full bg-white/[.22]">
          <span
            className="block h-full rounded-full bg-white"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, goal.progress)) * 100)}%` }}
          />
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-[3px] text-[12px] text-white/[.86]">
          {buildGoalMeta(goal).map((part, i) => (
            <span key={part.text} className="contents">
              {i > 0 && <span aria-hidden>·</span>}
              <span className={cx(part.live && "text-white")}>{part.text}</span>
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
