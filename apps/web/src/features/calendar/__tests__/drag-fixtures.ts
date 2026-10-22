import type { DragState } from "../drag-state";

export function buildDrag(overrides: Partial<DragState>): DragState {
  return {
    id: "t1",
    mode: "move",
    origDate: "2026-10-19",
    origStart: 600,
    origDur: 60,
    grabMin: 0,
    moved: false,
    startX: 0,
    startY: 0,
    zone: "timed",
    pointerId: 1,
    ...overrides,
  };
}
