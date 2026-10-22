import type { DragMode, DropZone } from "./geometry";

export interface GroupMember {
  id: string;
  date: string;
  start: number;
  durationMin: number;
  allDay: boolean;
}

export interface DragState {
  id: string;
  /** "allday" = a drag that began on an all-day chip; it can stay untimed or take a time. */
  mode: DragMode | "allday";
  origDate: string;
  origStart: number;
  origDur: number;
  grabMin: number;
  moved: boolean;
  /** pointer origin for the drag threshold. */
  startX: number;
  startY: number;
  /** sticky untimed-vs-timed zone, carried across pointermoves (allday mode only). */
  zone: DropZone;
  /** when set, the move shifts a whole selection by the anchor's delta. */
  group?: GroupMember[];
  /** How a touch drag was entered; `undefined` for a mouse or a pen past `sm`. */
  touchOrigin?: "arm" | "armed-press";
  /** The pointer that owns this drag — the window listeners ignore every other one. */
  pointerId: number;
}

export interface DragPreview {
  date: string;
  start: number;
  durationMin: number;
  /** the release keeps the task untimed — start/durationMin are then inert */
  isUntimed: boolean;
}
