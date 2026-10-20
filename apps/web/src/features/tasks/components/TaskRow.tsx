import { ALIGN_LABEL, getAlignment } from "@/core/lib/align";
import { useStore } from "@/core/store";
import { cx, Icon, Tag } from "@/core/ui";
import { useValueVoteToast } from "@/features/values/useValueVoteToast";
import type { Task } from "../model";

const STATUS_BOX: Record<Task["status"], { icon?: "check" | "skip"; solid: boolean }> = {
  open: { solid: false },
  todo: { solid: false },
  done: { icon: "check", solid: true },
  skip: { icon: "skip", solid: true },
};

export function TaskRow({
  task,
  onOpen,
  showDate,
}: {
  task: Task;
  onOpen?: (t: Task) => void;
  showDate?: boolean;
}) {
  const cycleStatus = useStore((s) => s.cycleStatus);
  const announceVote = useValueVoteToast();
  const value = useStore((s) => s.values.find((v) => v.id === task.valueId));
  const isResolved = task.status === "done" || task.status === "skip";
  const box = STATUS_BOX[task.status];

  return (
    <div className={cx("group flex items-center gap-3 py-2.5", isResolved && "opacity-55")}>
      <span className="w-11 shrink-0 text-xs tabular-nums text-muted">{task.time ?? "—"}</span>

      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onOpen?.(task)}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: value?.hue ?? "var(--color-mist)" }}
        />
        <span
          className={cx(
            "truncate text-sm text-foreground",
            isResolved && "line-through decoration-1",
          )}
        >
          {task.title}
        </span>
        {task.detached && <Icon name="unlink" size={12} className="shrink-0 text-muted" />}
        {task.note && <Icon name="note" size={12} className="shrink-0 text-muted" />}
      </button>

      <div className="hidden items-center gap-1.5 sm:flex">
        {showDate && task.date && <span className="text-xs text-muted">{task.date.slice(5)}</span>}
        {task.kind === "habit" && <Tag>Habit</Tag>}
        <Tag>{value ? value.name : ALIGN_LABEL[getAlignment(task)]}</Tag>
      </div>

      <button
        type="button"
        aria-label={`Toggle ${task.title}`}
        onClick={() => {
          cycleStatus(task.id);
          if (task.status === "todo" || task.status === "open") announceVote(task);
        }}
        className={cx(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
          box.solid
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border text-transparent hover:border-accent",
        )}
      >
        {box.icon && <Icon name={box.icon} size={13} />}
      </button>
    </div>
  );
}
