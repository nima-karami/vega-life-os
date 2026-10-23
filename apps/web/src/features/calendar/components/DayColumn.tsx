import { memo, useMemo } from "react";
import { addMinutes, formatShortDate, minutesOf, type WeekDay } from "@/core/lib/date";
import { cx } from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import type { Task } from "@/features/tasks";
import type { ChipHandlers } from "../chip-handlers";
import type { ChipPlacement } from "../day-index";
import type { DragPreview } from "../drag-state";
import { CalendarEventChip } from "../EventEditor";
import {
  formatMinutes,
  getChipHeight,
  getChipTop,
  HOUR_PX,
  HOURS,
  layoutColumns,
} from "../geometry";
import { NowLine } from "./NowLine";
import { TimedChip } from "./TimedChip";

export interface ColumnHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDownCapture: () => void;
  onClick: (e: React.MouseEvent, dayIso: string) => void;
  onContextMenu: (e: React.MouseEvent, dayIso: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}

interface DayColumnProps {
  day: WeekDay;
  tasks: readonly Task[];
  placements: ReadonlyMap<string, ChipPlacement>;
  lived: CalendarEvent[];
  /** The live drag's preview, only while it lands on this day's grid. */
  targetPreview: DragPreview | null;
  /** Title of an all-day chip being dragged onto this day's grid, drawn as a ghost. */
  allDayGhostTitle: string | null;
  dragId: string | null;
  focusGoalId: string | null;
  selectedIds: Set<string>;
  provisional: Set<string>;
  armedChipId: string | null;
  hasClipboard: boolean;
  displayZone: string;
  isTouchDragLiveRef: React.RefObject<boolean>;
  chipHandlers: ChipHandlers;
  columnHandlers: ColumnHandlers;
}

const FALLBACK_SLOT = { col: 0, cols: 1 };

const getStoredPlacement = (task: Task): ChipPlacement => ({
  date: task.date ?? "",
  start: minutesOf(task.time ?? "00:00"),
  durationMin: task.durationMin,
});

export const DayColumn = memo(function DayColumn({
  day,
  tasks,
  placements,
  lived,
  targetPreview,
  allDayGhostTitle,
  dragId,
  focusGoalId,
  selectedIds,
  provisional,
  armedChipId,
  hasClipboard,
  displayZone,
  isTouchDragLiveRef,
  chipHandlers,
  columnHandlers,
}: DayColumnProps) {
  const chips = useMemo(
    () =>
      tasks.map((task) => ({
        task,
        placement: placements.get(task.id) ?? getStoredPlacement(task),
      })),
    [tasks, placements],
  );
  const layout = useMemo(
    () =>
      layoutColumns([
        ...chips.map(({ task, placement }) => ({
          id: task.id,
          start: placement.start,
          durationMin: placement.durationMin,
        })),
        ...lived.map((ev) => ({
          id: ev.id,
          start: minutesOf(ev.time ?? "00:00"),
          durationMin: ev.durationMin,
        })),
      ]),
    [chips, lived],
  );

  return (
    <div
      className={cx(
        "relative border-l border-border",
        targetPreview ? "bg-surface-secondary" : day.today && "bg-surface-secondary/40",
      )}
    >
      <button
        type="button"
        aria-label={`Add task on ${day.dow}, ${formatShortDate(day.iso)}${day.today ? ", today" : ""}`}
        onPointerDown={columnHandlers.onPointerDown}
        onKeyDownCapture={columnHandlers.onKeyDownCapture}
        onClick={(e) => columnHandlers.onClick(e, day.iso)}
        onContextMenu={(e) => columnHandlers.onContextMenu(e, day.iso)}
        className={cx(
          "absolute inset-0 z-0 block w-full",
          hasClipboard ? "cursor-copy" : "cursor-default",
        )}
      />
      {HOURS.map((h, i) => (
        <div
          key={h}
          className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
          style={{ top: i * HOUR_PX }}
        />
      ))}
      {day.today && <NowLine zone={displayZone} />}
      {targetPreview && allDayGhostTitle != null && (
        <div
          className="pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-[2px] border-l-[3px] border-accent bg-surface/80 px-1.5 py-1 shadow-md ring-1 ring-accent"
          style={{
            top: getChipTop(targetPreview.start),
            height: getChipHeight(targetPreview.durationMin),
          }}
        >
          <span className="block truncate text-[11px] leading-tight text-foreground">
            {allDayGhostTitle}
          </span>
        </div>
      )}
      {targetPreview && (
        <div
          className="pointer-events-none absolute inset-x-0 z-40 flex items-center gap-1"
          style={{ top: getChipTop(targetPreview.start) }}
        >
          <span className="-translate-y-1/2 rounded-[12px] bg-foreground px-1.5 py-0.5 text-[9px] tabular-nums leading-none text-background shadow-sm">
            {formatMinutes(targetPreview.start)}-
            {addMinutes(formatMinutes(targetPreview.start), targetPreview.durationMin)}
          </span>
          <span className="h-px flex-1 bg-foreground/60" />
        </div>
      )}
      {chips.map(({ task, placement }) => {
        const slot = layout[task.id] ?? FALLBACK_SLOT;
        return (
          <TimedChip
            key={task.id}
            task={task}
            start={placement.start}
            durationMin={placement.durationMin}
            column={slot.col}
            columnCount={slot.cols}
            dragging={dragId === task.id}
            dim={Boolean(focusGoalId) && task.goalId !== focusGoalId}
            detached={task.kind === "habit" && task.detached}
            selected={selectedIds.has(task.id)}
            provisional={provisional.has(task.id)}
            isArmed={armedChipId === task.id}
            isTouchDragLiveRef={isTouchDragLiveRef}
            handlers={chipHandlers}
          />
        );
      })}
      {lived.map((ev) => (
        <CalendarEventChip
          key={ev.id}
          event={ev}
          variant="timed"
          slot={layout[ev.id] ?? FALLBACK_SLOT}
          onOpen={() => columnHandlers.onOpenEvent(ev)}
        />
      ))}
    </div>
  );
});
