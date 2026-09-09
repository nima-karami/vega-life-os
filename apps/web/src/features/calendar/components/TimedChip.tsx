import { addMinutes } from "@/core/lib/date";
import { ContextMenu, cx, Icon, type MenuItem } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import {
  type ColumnSlot,
  DRAG_THRESHOLD_PX,
  formatMinutes,
  getChipHeight,
  getChipTop,
  isOffWindow,
} from "../geometry";

export function TimedChip({
  task,
  eff,
  slot,
  dragging,
  dim,
  detached,
  selected,
  provisional,
  onPointerDownBody,
  onPointerUpBody,
  onPointerCancelBody,
  onPointerDownTop,
  onPointerDownBottom,
  onOpen,
  onLongPress,
  menuItems,
}: {
  task: Task;
  eff: { start: number; durationMin: number };
  slot: ColumnSlot;
  dragging: boolean;
  dim: boolean;
  detached: boolean;
  selected: boolean;
  provisional: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onPointerUpBody: (e: React.PointerEvent) => void;
  onPointerCancelBody: () => void;
  onPointerDownTop: (e: React.PointerEvent) => void;
  onPointerDownBottom: (e: React.PointerEvent) => void;
  onOpen: () => void;
  onLongPress: () => void;
  menuItems: MenuItem[];
}) {
  const accent = useValueColor(task.valueId);
  const top = getChipTop(eff.start);
  const height = getChipHeight(eff.durationMin);
  // side-by-side columns for overlapping chips; 2px gutters keep them distinct
  const left = `calc(${(slot.col / slot.cols) * 100}% + 2px)`;
  const width = `calc(${100 / slot.cols}% - 4px)`;
  const resolved = task.status === "done" || task.status === "skip";
  const off = isOffWindow(eff.start);
  const timeLabel = dragging
    ? `${formatMinutes(eff.start)}–${addMinutes(formatMinutes(eff.start), eff.durationMin)}`
    : task.time;

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
        onPointerUp={onPointerUpBody}
        onPointerCancel={onPointerCancelBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, ${task.time}–${addMinutes(task.time ?? "00:00", task.durationMin)}${detached ? ", detached" : ""}${selected ? ", selected" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          // A swipe belongs to the grid's scroller at every width — `touch-action` cannot read
          // the pointer, so a `sm:touch-none` froze the finger on a touchscreen laptop.
          "group absolute block cursor-grab touch-manipulation select-none overflow-hidden rounded-[2px] border-l-[3px] px-1.5 py-1 text-left shadow-sm",
          resolved ? "bg-surface-secondary" : "bg-surface",
          dim ? "opacity-30" : "opacity-100",
          selected && "z-20 ring-2 ring-accent",
          provisional && !selected && "z-20 ring-2 ring-accent/40",
          dragging
            ? "z-30 cursor-grabbing shadow-md ring-1 ring-accent"
            : "transition-[top,height] duration-75",
        )}
        style={{
          top,
          height,
          left,
          width,
          borderColor: accent,
        }}
      >
        {(off || detached) && (
          <span className="absolute right-1 top-1 flex items-center gap-0.5 text-muted">
            {detached && (
              <span title="Edited away from its habit" aria-hidden="true">
                <Icon name="unlink" size={10} />
              </span>
            )}
            {off && (
              <span title="Outside the visible hours" aria-hidden="true">
                <Icon name="alert" size={10} />
              </span>
            )}
          </span>
        )}
        <span
          onPointerDown={onPointerDownTop}
          className="absolute inset-x-0 top-0 z-10 flex h-1.5 cursor-ns-resize items-start justify-center opacity-0 group-hover:opacity-100"
        >
          <span className="mt-px h-0.5 w-5 rounded-full bg-border" />
        </span>
        <span
          className={cx(
            "block truncate text-[11px] leading-tight",
            resolved ? "text-muted line-through" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        {height > 34 && (
          <span className="mt-0.5 block text-[9px] tabular-nums text-muted">{timeLabel}</span>
        )}
        <span
          onPointerDown={onPointerDownBottom}
          className="absolute inset-x-0 bottom-0 z-10 flex h-1.5 cursor-ns-resize items-end justify-center opacity-0 group-hover:opacity-100"
        >
          <span className="mb-px h-0.5 w-5 rounded-full bg-border" />
        </span>
      </button>
    </ContextMenu>
  );
}
