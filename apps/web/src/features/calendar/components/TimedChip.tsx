import { memo } from "react";
import { addMinutes } from "@/core/lib/date";
import { ContextMenu, cx } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import {
  getChipCursorClass,
  getChipRingClass,
  getChipShadowClass,
  getChipTouchActionClass,
  getChipZIndexClass,
} from "../chip-armed";
import type { ChipHandlers } from "../chip-handlers";
import { buildTimedChipLabel, isResolvedStatus } from "../chip-label";
import {
  DRAG_THRESHOLD_PX,
  formatMinutes,
  getChipHeight,
  getChipTop,
  isOffWindow,
} from "../geometry";
import { useTouchDragBlocker } from "../useTouchDragBlocker";
import { ArmedResizeHandle } from "./ArmedResizeHandle";
import { ChipStatusBadges } from "./ChipStatusBadges";

interface TimedChipProps {
  task: Task;
  start: number;
  durationMin: number;
  /** Side-by-side slot for overlapping chips, as numbers so an unchanged slot compares equal. */
  column: number;
  columnCount: number;
  dragging: boolean;
  dim: boolean;
  detached: boolean;
  selected: boolean;
  provisional: boolean;
  isArmed: boolean;
  isTouchDragLiveRef: React.RefObject<boolean>;
  handlers: ChipHandlers;
}

export const TimedChip = memo(function TimedChip({
  task,
  start,
  durationMin,
  column,
  columnCount,
  dragging,
  dim,
  detached,
  selected,
  provisional,
  isArmed,
  isTouchDragLiveRef,
  handlers,
}: TimedChipProps) {
  const accent = useValueColor(task.valueId);
  const chipRef = useTouchDragBlocker(isTouchDragLiveRef);
  const top = getChipTop(start);
  const height = getChipHeight(durationMin);
  // side-by-side columns for overlapping chips; 2px gutters keep them distinct
  const left = `calc(${(column / columnCount) * 100}% + 2px)`;
  const width = `calc(${100 / columnCount}% - 4px)`;
  const chipState = {
    isArmed,
    isSelected: selected,
    isProvisional: provisional,
    isDragging: dragging,
  };
  const resolved = isResolvedStatus(task.status);
  const timeLabel = dragging
    ? `${formatMinutes(start)}-${addMinutes(formatMinutes(start), durationMin)}`
    : task.time;

  return (
    <>
      <ContextMenu
        items={handlers.getTimedMenuItems(task)}
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
          onPointerDown={(e) => handlers.onTimedPointerDown(e, task, "move")}
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
          aria-label={buildTimedChipLabel({ task, isDetached: detached, isSelected: selected })}
          className={cx(
            // A swipe belongs to the grid's scroller at every width — `touch-action` cannot read
            // the pointer, so a `sm:touch-none` froze the finger on a touchscreen laptop.
            `group absolute block ${getChipTouchActionClass(isArmed)} select-none overflow-hidden rounded-[2px] border-l-[3px] px-1.5 py-1 text-left`,
            resolved ? "bg-surface-secondary" : "bg-surface",
            dim ? "opacity-30" : "opacity-100",
            getChipZIndexClass(chipState),
            getChipCursorClass(dragging),
            getChipShadowClass(isArmed || dragging),
            getChipRingClass(chipState),
            !dragging && "transition-[top,height] duration-75",
          )}
          style={{
            top,
            height,
            left,
            width,
            borderColor: accent,
          }}
        >
          <ChipStatusBadges isDetached={detached} isOffWindow={isOffWindow(start)} />
          <span
            onPointerDown={(e) => handlers.onTimedPointerDown(e, task, "top")}
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
            onPointerDown={(e) => handlers.onTimedPointerDown(e, task, "bottom")}
            className="absolute inset-x-0 bottom-0 z-10 flex h-1.5 cursor-ns-resize items-end justify-center opacity-0 group-hover:opacity-100"
          >
            <span className="mb-px h-0.5 w-5 rounded-full bg-border" />
          </span>
        </button>
      </ContextMenu>
      {/* Siblings, not children: the button is overflow-hidden, and a press inside the
          ContextMenu wrapper would start a menu timer that makes dwell-then-resize ambiguous. */}
      {isArmed &&
        (["top", "bottom"] as const).map((edge) => (
          <ArmedResizeHandle
            key={edge}
            edge={edge}
            chipTop={top}
            chipHeight={height}
            left={left}
            width={width}
            onPointerDown={(e) => handlers.onTimedPointerDown(e, task, edge)}
          />
        ))}
    </>
  );
});
