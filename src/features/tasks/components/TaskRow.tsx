import { ALIGN_LABEL, alignOf } from "@/core/lib/align";
import { useStore } from "@/core/store";
import { cx, Icon, Tag } from "@/core/ui";
import type { Task } from "../model";
import { ENERGY_META } from "../model";
import { energyOf } from "../selectors";

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
  const value = useStore((s) => s.values.find((v) => v.id === task.valueId));
  const resolved = task.status === "done" || task.status === "skip";
  const box = STATUS_BOX[task.status];

  return (
    <div className={cx("group flex items-center gap-3 py-2.5", resolved && "opacity-55")}>
      <span className="w-11 shrink-0 text-tiny tabular-nums text-default-500">
        {task.time ?? "—"}
      </span>

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
            "truncate text-small text-foreground",
            resolved && "line-through decoration-1",
          )}
        >
          {task.title}
        </span>
        {energyOf(task) !== "neutral" && (
          <span
            className="shrink-0 text-tiny leading-none text-default-500"
            title={ENERGY_META[energyOf(task)].label}
          >
            {ENERGY_META[energyOf(task)].glyph}
          </span>
        )}
        {task.detached && <Icon name="unlink" size={12} className="shrink-0 text-default-400" />}
        {task.note && <Icon name="note" size={12} className="shrink-0 text-default-400" />}
      </button>

      <div className="hidden items-center gap-1.5 sm:flex">
        {showDate && task.date && (
          <span className="text-tiny text-default-400">{task.date.slice(5)}</span>
        )}
        {task.kind === "habit" && <Tag>Habit</Tag>}
        <Tag>{value ? value.name : ALIGN_LABEL[alignOf(task)]}</Tag>
      </div>

      <button
        type="button"
        aria-label={`Toggle ${task.title}`}
        onClick={() => cycleStatus(task.id)}
        className={cx(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
          box.solid
            ? "border-primary bg-primary text-primary-foreground"
            : "border-default-300 text-transparent hover:border-primary",
        )}
      >
        {box.icon && <Icon name={box.icon} size={13} />}
      </button>
    </div>
  );
}
