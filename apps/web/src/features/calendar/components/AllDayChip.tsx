import { ContextMenu, cx, type MenuItem } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";

export function AllDayChip({
  task,
  dragging,
  selected,
  onPointerDownBody,
  onOpen,
  menuItems,
}: {
  task: Task;
  dragging: boolean;
  selected: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onOpen: () => void;
  menuItems: MenuItem[];
}) {
  const accent = useValueColor(task.valueId);
  const resolved = task.status === "done" || task.status === "skip";
  return (
    <ContextMenu items={menuItems}>
      <button
        type="button"
        data-block
        aria-pressed={selected}
        onPointerDown={onPointerDownBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, all day${selected ? ", selected" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          "block w-full cursor-grab touch-none select-none truncate rounded-[2px] border-l-[3px] bg-surface px-1.5 py-0.5 text-left text-[10px] text-foreground shadow-sm",
          dragging && "opacity-40",
          selected && "ring-2 ring-accent",
        )}
        style={{ borderColor: accent }}
      >
        <span className={cx("truncate", resolved && "text-muted line-through")}>{task.title}</span>
      </button>
    </ContextMenu>
  );
}
