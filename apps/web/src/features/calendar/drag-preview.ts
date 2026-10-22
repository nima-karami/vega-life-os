import type { DragPreview, DragState } from "./drag-state";
import {
  DAY_START,
  DRAG_THRESHOLD_PX,
  DROP_DURATION,
  type DragMode,
  type DropZone,
  dropToSchedule,
  getColumnIndexAt,
  HOUR_PX,
  resolveDrag,
  resolveDropZone,
} from "./geometry";

interface PixelBox {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

interface DragPointerContext {
  clientX: number;
  clientY: number;
  gridRect: PixelBox;
  /** The all-day row's box; absent when the row is not mounted. */
  allDayRect: PixelBox | undefined;
  columns: readonly { iso: string }[];
}

interface PlacedDrag {
  zone: DropZone;
  preview: DragPreview;
}

const getColumnDateAt = (clientX: number, box: PixelBox, columns: readonly { iso: string }[]) =>
  columns[getColumnIndexAt(clientX, box, columns.length)].iso;

function placeAllDayDrag(zone: DropZone, ctx: DragPointerContext): PlacedDrag {
  const { clientX, clientY, gridRect, allDayRect, columns } = ctx;
  // The seam is the all-day row's bottom edge; with no row box, stay untimed rather than schedule.
  const nextZone = allDayRect ? resolveDropZone(clientY - allDayRect.bottom, zone) : "untimed";
  if (nextZone === "timed") {
    const preview = {
      date: getColumnDateAt(clientX, gridRect, columns),
      start: dropToSchedule(clientY - gridRect.top).startMin,
      durationMin: DROP_DURATION,
      isUntimed: false,
    };
    return { zone: nextZone, preview };
  }
  const preview = {
    date: getColumnDateAt(clientX, allDayRect ?? gridRect, columns),
    start: DAY_START,
    durationMin: DROP_DURATION,
    isUntimed: true,
  };
  return { zone: nextZone, preview };
}

function placeTimedDrag(drag: DragState, mode: DragMode, ctx: DragPointerContext): PlacedDrag {
  const { clientX, clientY, gridRect, columns } = ctx;
  const pointerMin = DAY_START + ((clientY - gridRect.top) / HOUR_PX) * 60;
  const resolved = resolveDrag(
    mode,
    { origDate: drag.origDate, origStart: drag.origStart, origDur: drag.origDur },
    { pointerMin, grabMin: drag.grabMin, targetDate: getColumnDateAt(clientX, gridRect, columns) },
  );
  return { zone: drag.zone, preview: { ...resolved, isUntimed: false } };
}

/** Where a drag past its threshold lands under the pointer; an all-day drag also re-picks its zone. */
export function placeDragAt(drag: DragState, ctx: DragPointerContext): PlacedDrag {
  if (drag.mode === "allday") return placeAllDayDrag(drag.zone, ctx);
  return placeTimedDrag(drag, drag.mode, ctx);
}

/** Sub-threshold jitter is not a drag, so a still press still opens the chip. */
export const isPastDragThreshold = (drag: DragState, clientX: number, clientY: number) =>
  drag.moved || Math.hypot(clientX - drag.startX, clientY - drag.startY) >= DRAG_THRESHOLD_PX;

export const getTravelMode = (mode: DragState["mode"]): DragMode =>
  mode === "allday" ? "move" : mode;
