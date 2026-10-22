import { differenceInCalendarDays, parseISO } from "date-fns";
import { addMinutes, formatShortDate } from "@/core/lib/date";
import type { Task } from "@/features/tasks";
import type { DragPreview, DragState } from "./drag-state";
import { DROP_DURATION, formatMinutes } from "./geometry";

type DragRelease =
  | { kind: "rest" }
  | { kind: "tap" }
  | { kind: "open" }
  | { kind: "dropped" }
  | { kind: "commit"; patch: Partial<Task>; announcement: string }
  | { kind: "group-shift"; dayDelta: number; minDelta: number };

const REST: DragRelease = { kind: "rest" };
const DROPPED: DragRelease = { kind: "dropped" };

function resolveAllDayRelease(
  drag: DragState,
  preview: DragPreview,
  task: Task | undefined,
): DragRelease {
  // A still arming release comes to rest armed; a still plain release is a tap that opens it.
  if (!drag.moved) return drag.touchOrigin === "arm" || !task ? REST : { kind: "open" };
  if (!task) return DROPPED; // vanished under a mid-drag refetch
  if (preview.isUntimed) {
    if (preview.date === drag.origDate) return DROPPED; // released over its own bucket
    return {
      kind: "commit",
      patch: { date: preview.date },
      announcement: `Moved ${task.title} to ${formatShortDate(preview.date)}`,
    };
  }
  const time = formatMinutes(preview.start);
  return {
    kind: "commit",
    patch: {
      date: preview.date,
      time,
      durationMin: DROP_DURATION,
      ...(task.status === "open" ? { status: "todo" as const } : {}),
    },
    announcement: `Scheduled ${task.title} on ${preview.date}, ${time} to ${addMinutes(time, DROP_DURATION)}`,
  };
}

function resolveTimedRelease(drag: DragState, preview: DragPreview): DragRelease {
  if (drag.group && drag.moved) {
    return {
      kind: "group-shift",
      dayDelta: differenceInCalendarDays(parseISO(preview.date), parseISO(drag.origDate)),
      minDelta: preview.start - drag.origStart,
    };
  }
  const isChanged =
    preview.date !== drag.origDate ||
    preview.start !== drag.origStart ||
    preview.durationMin !== drag.origDur;
  if (isChanged) {
    const time = formatMinutes(preview.start);
    return {
      kind: "commit",
      patch: { date: preview.date, time, durationMin: preview.durationMin },
      announcement: `Moved to ${preview.date}, ${time} to ${addMinutes(time, preview.durationMin)}`,
    };
  }
  // An arming release must not also count as a tap; every other term reduces to the
  // pre-touch expression when `touchOrigin` is undefined.
  if (drag.moved || drag.touchOrigin === "arm") return REST;
  return drag.mode === "move" || drag.touchOrigin === "armed-press" ? { kind: "tap" } : REST;
}

/** What a drag release means: commit a real change, or treat a no-move as a tap. */
export function resolveDragRelease(
  drag: DragState,
  preview: DragPreview,
  task: Task | undefined,
): DragRelease {
  return drag.mode === "allday"
    ? resolveAllDayRelease(drag, preview, task)
    : resolveTimedRelease(drag, preview);
}
