import { useStore } from "@/core/store";
import { cx, Icon, Tag } from "@/core/ui";
import { alignOf, ALIGN_TAG } from "@/core/lib/align";
import { ENERGY_META } from "../model";
import { energyOf } from "../selectors";
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
  const value = useStore((s) => s.values.find((v) => v.id === task.valueId));
  const resolved = task.status === "done" || task.status === "skip";
  const box = STATUS_BOX[task.status];

  return (
    <div
      className={cx(
        "group flex items-center gap-3 py-2.5",
        resolved && "opacity-55",
      )}
    >
      <span className="mono w-11 shrink-0 text-[11px] tabular-nums text-stone">
        {task.time ?? "—"}
      </span>

      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onOpen?.(task)}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: value?.hue ?? "var(--color-mist)" }}
        />
        <span
          className={cx(
            "truncate text-[13px]",
            resolved && "line-through decoration-1",
          )}
        >
          {task.title}
        </span>
        {energyOf(task) !== "neutral" && (
          <span
            className="mono shrink-0 text-[11px] leading-none"
            title={ENERGY_META[energyOf(task)].label}
            style={{ color: energyOf(task) === "drain" ? "var(--color-signal)" : "var(--color-ink)" }}
          >
            {ENERGY_META[energyOf(task)].glyph}
          </span>
        )}
        {task.detached && <Icon name="unlink" size={12} className="shrink-0 text-mist" />}
        {task.note && <Icon name="note" size={12} className="shrink-0 text-mist" />}
      </button>

      <div className="hidden items-center gap-1.5 sm:flex">
        {showDate && task.date && (
          <span className="mono text-[10px] text-mist">{task.date.slice(5)}</span>
        )}
        {task.kind === "habit" && <Tag>HABIT</Tag>}
        <Tag>{value ? value.name.toUpperCase() : ALIGN_TAG[alignOf(task)]}</Tag>
      </div>

      <button
        aria-label={`Toggle ${task.title}`}
        onClick={() => cycleStatus(task.id)}
        className={cx(
          "grid h-6 w-6 shrink-0 place-items-center border transition-colors",
          box.solid
            ? "border-ink bg-ink text-paper"
            : "border-[var(--color-line-strong)] text-transparent hover:border-ink",
        )}
      >
        {box.icon && <Icon name={box.icon} size={13} />}
      </button>
    </div>
  );
}
