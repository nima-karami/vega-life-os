import { ContextMenu, cx, type MenuItem } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import { DRAG_THRESHOLD_PX } from "../geometry";

export function AllDayChip({
  task,
  dragging,
  selected,
  onPointerDownBody,
  onOpen,
  onLongPress,
  onChipContextMenu,
  menuItems,
}: {
  task: Task;
  dragging: boolean;
  selected: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onOpen: () => void;
  onLongPress: () => void;
  /** Swallow a native `contextmenu` synthesized by an un-armed touch hold. */
  onChipContextMenu: (e: React.MouseEvent) => void;
  menuItems: MenuItem[];
}) {
  const accent = useValueColor(task.valueId);
  const resolved = task.status === "done" || task.status === "skip";
  return (
    <ContextMenu
      items={menuItems}
      longPress
      longPressMoveTolerancePx={DRAG_THRESHOLD_PX}
      onLongPress={onLongPress}
    >
      <button
        type="button"
        data-block
        data-chip-id={task.id}
        aria-pressed={selected}
        onPointerDown={onPointerDownBody}
        onContextMenu={onChipContextMenu}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, all day${selected ? ", selected" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          "block w-full cursor-grab touch-none select-none truncate rounded-[2px] border-l-[3px] bg-surface px-1.5 py-0.5 text-left text-[10px] text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
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
