import type { IconName } from "@/core/lib/icon-names";
import { Icon } from "@/core/ui";
import { BackToItLine } from "@/features/habits/BackToItLine";
import type { Value } from "@/features/values/model";
import type { Task } from "../model";
import { SkippedBadge } from "./SkippedBadge";
import { TaskTitle } from "./TaskTitle";

interface CompactTaskBodyProps {
  task: Task;
  icon: IconName;
  plan: string;
  value: Value | undefined;
  hue: string | null;
  onOpen: (t: Task) => void;
}

/** The slim Anytime row's open button: habit icon, title column, value name on the right. */
export function CompactTaskBody({ task, icon, plan, value, hue, onOpen }: CompactTaskBodyProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="task-card__body flex min-w-0 flex-1 items-center gap-2.5 py-[7px] text-left"
    >
      <Icon name={icon} size={15} className="shrink-0 text-muted" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-px">
        <span className="flex w-full items-center gap-2">
          <TaskTitle title={task.title} />
          {task.status === "skip" && <SkippedBadge />}
        </span>
        {plan !== "" && (
          <span className="max-w-full truncate text-xs text-muted" title={plan}>
            {plan}
          </span>
        )}
        <BackToItLine task={task} />
      </span>
      {value && (
        <span
          className="max-w-[40%] shrink-0 truncate text-xs font-medium"
          style={{ color: hue ?? undefined }}
        >
          {value.name}
        </span>
      )}
    </button>
  );
}
