import { Icon } from "@/core/ui";
import type { Task } from "../model";
import { type CardDensity, getCheckLabel } from "../task-card";

interface DoneCheckProps {
  task: Task;
  density: CardDensity;
  onToggle: (task: Task) => void;
}

// 44px on a phone, 20px at `sm`; the negative margins keep the ring where a 20px box sits.
const CHECK_MARGIN_CLASS = {
  card: "-mt-2.5 -mb-3 -ms-3 -me-3 sm:mt-0.5 sm:mb-0 sm:ms-0 sm:me-0",
  compact: "-my-3 -mx-3 sm:m-0",
} as const;

/** The ring must stay the button's first span: the 44px hit-box e2e measures it. */
export function DoneCheck({ task, density, onToggle }: DoneCheckProps) {
  return (
    <button
      type="button"
      aria-pressed={task.status === "done"}
      aria-label={getCheckLabel(task)}
      onClick={() => onToggle(task)}
      className={`task-card__check relative z-[2] grid h-11 w-11 shrink-0 place-items-center sm:h-5 sm:w-5 ${CHECK_MARGIN_CLASS[density]}`}
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
