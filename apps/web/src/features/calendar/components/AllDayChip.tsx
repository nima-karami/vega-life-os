import { ContextMenu, cx, type MenuItem } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import {
  ARMED_CHIP_CLASS,
  ARMED_RING_CLASS,
  getChipShadowClass,
  getChipTouchActionClass,
} from "../chip-armed";
import { DRAG_THRESHOLD_PX } from "../geometry";
import { useTouchDragBlocker } from "../useTouchDragBlocker";

export function AllDayChip({
  task,
  dragging,
  selected,
  isArmed,
  isTouchDragLiveRef,
  onPointerDownBody,
  onPointerUpBody,
  onPointerCancelBody,
  onOpen,
  onLongPress,
  onChipContextMenu,
  onKeyDownCapture,
  menuItems,
}: {
  task: Task;
  dragging: boolean;
  selected: boolean;
  isArmed: boolean;
  isTouchDragLiveRef: React.RefObject<boolean>;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onPointerUpBody: (e: React.PointerEvent) => void;
  onPointerCancelBody: () => void;
  onOpen: () => void;
  onLongPress: () => void;
  /** Swallow a native `contextmenu` synthesized by an un-armed touch hold. */
  onChipContextMenu: (e: React.MouseEvent) => void;
  /** A keyboard-invoked menu carries no press, so the swallow above must forget the last one. */
  onKeyDownCapture: () => void;
  menuItems: MenuItem[];
}) {
  const accent = useValueColor(task.valueId);
  const chipRef = useTouchDragBlocker(isTouchDragLiveRef);
  const resolved = task.status === "done" || task.status === "skip";
  return (
    <ContextMenu
      items={menuItems}
      longPress={isArmed}
      longPressMoveTolerancePx={DRAG_THRESHOLD_PX}
      onLongPress={onLongPress}
    >
      <button
        ref={chipRef}
        type="button"
        data-block
        data-chip-id={task.id}
        data-armed={isArmed ? "true" : undefined}
        aria-pressed={selected}
        onPointerDown={onPointerDownBody}
        onPointerUp={onPointerUpBody}
        onPointerCancel={onPointerCancelBody}
        onContextMenu={onChipContextMenu}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
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
}
