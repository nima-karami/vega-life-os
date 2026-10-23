import { Icon } from "@/core/ui";
import { GOAL_STATUS_ICON, GOAL_STATUS_LABEL, type GoalStatus } from "../model";
import type { SealMotion } from "../useGoalSeal";

function StatusLabel({ status, isLeaving }: { status: GoalStatus; isLeaving?: boolean }) {
  return (
    <span
      className="goal-status-chip__label inline-flex items-center gap-1 rounded-full bg-accent/10 px-[9px] py-[3px] text-[12px] text-accent"
      data-leaving={isLeaving || undefined}
      aria-hidden={isLeaving || undefined}
    >
      <Icon name={GOAL_STATUS_ICON[status]} size={11} />
      {GOAL_STATUS_LABEL[status]}
    </span>
  );
}

/** Status chip that cross-fades on a seal or unseal; the leaving label stays stacked, hidden. */
export function GoalStatusChip({
  status,
  motion,
}: {
  status: GoalStatus;
  motion: SealMotion | null;
}) {
  const previous = motion && motion.previous !== status ? motion.previous : null;
  return (
    <span className="goal-status-chip" data-anim={motion?.anim ?? undefined}>
      {previous && <StatusLabel key={`out-${previous}`} status={previous} isLeaving />}
      <StatusLabel key={`in-${status}`} status={status} />
    </span>
  );
}
