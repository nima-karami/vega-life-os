import type { CalendarEvent } from "@vega/shared";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Task } from "@/features/tasks";
import type { DragPreview, DragState } from "./drag-state";
import { shiftSelection } from "./geometry";
import {
  getSingleDayAllDayLived,
  getTimedLivedForDay,
  isAllDayRowTask,
  isGridTask,
} from "./grid-data";

/** Where a chip draws while a drag is live, in place of its stored date and time. */
export interface ChipPlacement {
  date: string;
  start: number;
  durationMin: number;
}

export interface DayTasks {
  /** Grid chips (`isGridTask`), in store order. */
  readonly timed: readonly Task[];
  /** The all-day row (`isAllDayRowTask`), in store order. */
  readonly untimed: readonly Task[];
}

export interface TaskDayIndex {
  tasks: Task[];
  orderOf: Map<string, number>;
  byDay: Map<string, { timed: Task[]; untimed: Task[] }>;
}

export interface DayColumnTasks {
  tasks: readonly Task[];
  placements: ReadonlyMap<string, ChipPlacement>;
}

const EMPTY_DAY: DayTasks = Object.freeze({ timed: Object.freeze([]), untimed: Object.freeze([]) });
const NO_PLACEMENTS: ReadonlyMap<string, ChipPlacement> = new Map();

function addToDay(byDay: TaskDayIndex["byDay"], task: Task, dayIso: string) {
  const isTimed = isGridTask(task);
  if (!isTimed && !isAllDayRowTask(task)) return;
  let day = byDay.get(dayIso);
  if (!day) {
    day = { timed: [], untimed: [] };
    byDay.set(dayIso, day);
  }
  (isTimed ? day.timed : day.untimed).push(task);
}

export function buildTaskDayIndex(tasks: Task[]): TaskDayIndex {
  const orderOf = new Map<string, number>();
  const byDay: TaskDayIndex["byDay"] = new Map();
  tasks.forEach((task, order) => {
    orderOf.set(task.id, order);
    if (task.date != null) addToDay(byDay, task, task.date);
  });
  return { tasks, orderOf, byDay };
}

export function getDayTasks(index: TaskDayIndex, dayIso: string): DayTasks {
  return index.byDay.get(dayIso) ?? EMPTY_DAY;
}

export function findIndexedTask(index: TaskDayIndex, id: string | null): Task | null {
  const order = id == null ? undefined : index.orderOf.get(id);
  return order === undefined ? null : index.tasks[order];
}

export function computeDragPlacements(
  drag: DragState | null,
  dragId: string | null,
  preview: DragPreview | null,
): Map<string, ChipPlacement> {
  const placements = new Map<string, ChipPlacement>();
  if (!dragId || !preview) return placements;
  if (drag?.group) {
    const dayDelta = differenceInCalendarDays(parseISO(preview.date), parseISO(drag.origDate));
    const minDelta = preview.start - drag.origStart;
    for (const member of drag.group) {
      if (member.allDay) continue;
      const [shifted] = shiftSelection([member], dayDelta, minDelta);
      placements.set(member.id, {
        date: shifted.date,
        start: shifted.start,
        durationMin: member.durationMin,
      });
    }
  }
  placements.set(dragId, {
    date: preview.date,
    start: preview.start,
    durationMin: preview.durationMin,
  });
  return placements;
}

function findTimedTask(index: TaskDayIndex, id: string): Task | null {
  const task = findIndexedTask(index, id);
  return task && isGridTask(task) ? task : null;
}

function rebuildDayTasks(
  index: TaskDayIndex,
  dayIso: string,
  placements: ReadonlyMap<string, ChipPlacement>,
): Task[] {
  const staying = getDayTasks(index, dayIso).timed.filter(
    (task) => (placements.get(task.id)?.date ?? dayIso) === dayIso,
  );
  const arriving: Task[] = [];
  for (const [id, placement] of placements) {
    const task = findTimedTask(index, id);
    if (task && task.date !== dayIso && placement.date === dayIso) arriving.push(task);
  }
  const orderOf = (task: Task) => index.orderOf.get(task.id) ?? 0;
  return [...staying, ...arriving].sort((a, b) => orderOf(a) - orderOf(b));
}

/**
 * A day's grid chips with the live drag applied. A day the drag never touches gets back the
 * very lists it had before the drag, so a memoized column skips the frame.
 */
export function resolveDayColumn(
  index: TaskDayIndex,
  dayIso: string,
  placements: ReadonlyMap<string, ChipPlacement>,
): DayColumnTasks {
  const base = getDayTasks(index, dayIso).timed;
  const dayPlacements = new Map<string, ChipPlacement>();
  let isMembershipChanged = false;
  for (const [id, placement] of placements) {
    const task = findTimedTask(index, id);
    if (!task) continue;
    const isLanding = placement.date === dayIso;
    if (isLanding) dayPlacements.set(id, placement);
    if (isLanding !== (task.date === dayIso)) isMembershipChanged = true;
  }
  return {
    tasks: isMembershipChanged ? rebuildDayTasks(index, dayIso, placements) : base,
    placements: dayPlacements.size > 0 ? dayPlacements : NO_PLACEMENTS,
  };
}

export interface DayLivedEvents {
  timed: CalendarEvent[];
  allDay: CalendarEvent[];
}

export function indexLivedByDay(
  events: CalendarEvent[],
  dayIsos: string[],
): Map<string, DayLivedEvents> {
  return new Map(
    dayIsos.map((dayIso) => [
      dayIso,
      {
        timed: getTimedLivedForDay(events, dayIso),
        allDay: getSingleDayAllDayLived(events, dayIso),
      },
    ]),
  );
}
