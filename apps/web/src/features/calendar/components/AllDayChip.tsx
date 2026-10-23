import { memo } from "react";
import { ContextMenu, cx } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import {
  ARMED_CHIP_CLASS,
  ARMED_RING_CLASS,
  getChipShadowClass,
  getChipTouchActionClass,
} from "../chip-armed";
import type { ChipHandlers } from "../chip-handlers";
import { DRAG_THRESHOLD_PX } from "../geometry";
import { useTouchDragBlocker } from "../useTouchDragBlocker";

interface AllDayChipProps {
  task: Task;
  dragging: boolean;
  selected: boolean;
  isArmed: boolean;
  isTouchDragLiveRef: React.RefObject<boolean>;
  handlers: ChipHandlers;
}

export const AllDayChip = memo(function AllDayChip({
  task,
  dragging,
  selected,
  isArmed,
  isTouchDragLiveRef,
  handlers,
}: AllDayChipProps) {
  const accent = useValueColor(task.valueId);
  const chipRef = useTouchDragBlocker(isTouchDragLiveRef);
  const resolved = task.status === "done" || task.status === "skip";
  return (
    <ContextMenu
      items={handlers.getAllDayMenuItems(task)}
      longPress={isArmed}
      longPressMoveTolerancePx={DRAG_THRESHOLD_PX}
      onLongPress={handlers.onLongPress}
    >
      <button
        ref={chipRef}
        type="button"
        data-block
        data-chip-id={task.id}
        data-armed={isArmed ? "true" : undefined}
        aria-pressed={selected}
        onPointerDown={(e) => handlers.onAllDayPointerDown(e, task)}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
        onContextMenu={(e) => handlers.onContextMenu(e, task.id)}
        onKeyDownCapture={handlers.onKeyDownCapture}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlers.onOpen(task);
          }
        }}
        aria-label={`${task.title}, all day${selected ? ", selected" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          `block w-full cursor-grab ${getChipTouchActionClass(isArmed)} select-none truncate rounded-[2px] border-l-[3px] bg-surface px-1.5 py-0.5 text-left text-[10px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent`,
          dragging && "opacity-40",
          // A dragged all-day chip is the faded source behind its own ghost, so it never lifts.
          getChipShadowClass(isArmed),
          isArmed && ARMED_CHIP_CLASS,
          isArmed ? ARMED_RING_CLASS : selected && "ring-2 ring-accent",
        )}
        style={{ borderColor: accent }}
      >
        <span className={cx("truncate", resolved && "text-muted line-through")}>{task.title}</span>
      </button>
    </ContextMenu>
  );
});
