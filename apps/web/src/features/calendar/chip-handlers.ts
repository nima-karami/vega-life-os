import type { MenuItem } from "@/core/ui";
import type { Task } from "@/features/tasks";
import type { DragMode } from "./geometry";

/** One identity for every chip on the page, so a memoized chip re-renders only on its own data. */
export interface ChipHandlers {
  onTimedPointerDown: (e: React.PointerEvent, task: Task, mode: DragMode) => void;
  onAllDayPointerDown: (e: React.PointerEvent, task: Task) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: () => void;
  onOpen: (task: Task) => void;
  onLongPress: () => void;
  /** Swallow a native `contextmenu` synthesized by an un-armed touch hold. */
  onContextMenu: (e: React.MouseEvent, taskId: string) => void;
  /** A keyboard-invoked menu carries no press, so the swallow above must forget the last one. */
  onKeyDownCapture: () => void;
  getTimedMenuItems: (task: Task) => MenuItem[];
  getAllDayMenuItems: (task: Task) => MenuItem[];
}
