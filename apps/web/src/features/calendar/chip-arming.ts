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

type PhaseTransition = (event: ChipTouchEvent) => ChipTouchPhase | undefined;

const isReleaseOrCancel = (event: ChipTouchEvent) =>
  event.kind === "release" || event.kind === "cancel";

const PRESSING_TRANSITIONS: Partial<Record<ChipTouchEvent["kind"], ChipTouchPhase>> = {
  "hold-elapsed": "armed-pressing",
  travel: "idle",
  release: "idle",
  cancel: "idle",
};

const ARMED_PRESSING_TRANSITIONS: Partial<Record<ChipTouchEvent["kind"], ChipTouchPhase>> = {
  release: "armed",
  cancel: "armed",
  "menu-opened": "armed",
};

const dragPhaseFor = (mode: DragMode): ChipTouchPhase =>
  mode === "move" ? "dragging-move" : "dragging-resize";

const releaseToArmed: PhaseTransition = (event) => (isReleaseOrCancel(event) ? "armed" : undefined);

const PHASE_TRANSITIONS: Record<ChipTouchPhase, PhaseTransition> = {
  idle: (event) => (event.kind === "press" ? "pressing" : undefined),
  pressing: (event) => PRESSING_TRANSITIONS[event.kind],
  armed: (event) => (event.kind === "armed-press" ? "armed-pressing" : undefined),
  "armed-pressing": (event) =>
    event.kind === "travel" ? dragPhaseFor(event.mode) : ARMED_PRESSING_TRANSITIONS[event.kind],
  "dragging-move": releaseToArmed,
  "dragging-resize": releaseToArmed,
};

/** Total: an unmatched (phase, event) pair returns `phase` unchanged. */
export function advanceChipTouchPhase(
  phase: ChipTouchPhase,
  event: ChipTouchEvent,
): ChipTouchPhase {
  if (event.kind === "disarm") return "idle";
  return PHASE_TRANSITIONS[phase](event) ?? phase;
}
