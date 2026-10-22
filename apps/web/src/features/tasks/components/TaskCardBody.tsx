import { Icon, Lineage, ROW_META_CLASS } from "@/core/ui";
import { BackToItLine } from "@/features/habits/BackToItLine";
import type { TaskLineage } from "../lineage";
import type { Task } from "../model";
import { SkippedBadge } from "./SkippedBadge";
import { TaskTitle } from "./TaskTitle";

interface TaskCardBodyProps {
  task: Task;
  lineage: TaskLineage | null;
  plan: string;
  onOpen: (t: Task) => void;
}

/** The full card's open button: title, plan, nudge, then the lineage and the time. */
export function TaskCardBody({ task, lineage, plan, onOpen }: TaskCardBodyProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="task-card__body flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
    >
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

      <span className={ROW_META_CLASS}>
        {lineage && <Lineage lineage={lineage} variant="card" />}
        {task.time && (
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted">
            <Icon name="clock" size={11} />
            {task.time}
          </span>
        )}
        {task.detached && (
          <Icon name="unlink" size={12} className="text-muted" aria-label="Detached from habit" />
        )}
      </span>
    </button>
  );
}
