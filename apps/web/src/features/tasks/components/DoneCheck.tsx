import { Icon } from "@/core/ui";
import type { Task } from "../model";
import { getCheckLabel } from "../task-card";

interface DoneCheckProps {
  task: Task;
  onToggle: (task: Task) => void;
}

/** The ring must stay the button's first span: the 44px hit-box e2e measures it. */
export function DoneCheck({ task, onToggle }: DoneCheckProps) {
  return (
    <button
      type="button"
      aria-pressed={task.status === "done"}
      aria-label={getCheckLabel(task)}
      onClick={() => onToggle(task)}
      className="task-card__check relative z-[2] -mt-2.5 -mb-3 -ms-3 -me-3 grid h-11 w-11 shrink-0 place-items-center sm:mt-0.5 sm:mb-0 sm:ms-0 sm:me-0 sm:h-5 sm:w-5"
    >
      <span className="task-card__ring">
        <span className="task-card__halo" />
        <span className="task-card__disc" />
        {task.status === "skip" ? (
          <Icon name="skip" size={12} className="relative text-muted" />
        ) : (
          <Icon name="check" size={12} strokeWidth={3.8} className="task-card__tick" aria-hidden />
        )}
      </span>
    </button>
  );
}
