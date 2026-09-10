import type { DragMode } from "./geometry";

export type ChipTouchPhase =
  | "idle"
  | "pressing"
  | "armed"
  | "armed-pressing"
  | "dragging-move"
  | "dragging-resize";

export type ChipTouchEvent =
  | { kind: "press" }
  | { kind: "armed-press" }
  | { kind: "hold-elapsed" }
  | { kind: "travel"; mode: DragMode }
  | { kind: "release" }
  | { kind: "cancel" }
  | { kind: "menu-opened" }
  | { kind: "disarm" };

/** Total: an unmatched (phase, event) pair returns `phase` unchanged. */
export function advanceChipTouchPhase(
  phase: ChipTouchPhase,
  event: ChipTouchEvent,
): ChipTouchPhase {
  if (event.kind === "disarm") return "idle";

  switch (phase) {
    case "idle":
      return event.kind === "press" ? "pressing" : phase;
    case "pressing":
      if (event.kind === "hold-elapsed") return "armed-pressing";
      if (event.kind === "travel" || event.kind === "release" || event.kind === "cancel") {
        return "idle";
      }
      return phase;
    case "armed":
      return event.kind === "armed-press" ? "armed-pressing" : phase;
    case "armed-pressing":
      if (event.kind === "travel") {
        return event.mode === "move" ? "dragging-move" : "dragging-resize";
      }
      if (event.kind === "release" || event.kind === "cancel" || event.kind === "menu-opened") {
        return "armed";
      }
      return phase;
    default:
      return event.kind === "release" || event.kind === "cancel" ? "armed" : phase;
  }
}
