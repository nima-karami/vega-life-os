import { ARMED_HANDLE_PX, getArmedHandleTop } from "../chip-armed";

export interface ArmedResizeHandleProps {
  edge: "top" | "bottom";
  /** Chip box in day-column coordinates, from getChipTop / getChipHeight. */
  chipTop: number;
  chipHeight: number;
  /** The chip's own `left` / `width` calc() strings, so the pill tracks its overlap column. */
  left: string;
  width: string;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function ArmedResizeHandle({
  edge,
  chipTop,
  chipHeight,
  left,
  width,
  onPointerDown,
}: ArmedResizeHandleProps) {
  return (
    <span
      data-chip-handle
      aria-hidden="true"
      onPointerDown={onPointerDown}
      className="absolute z-30 flex touch-none cursor-ns-resize items-center justify-center"
      style={{
        top: getArmedHandleTop(edge, chipTop, chipHeight),
        height: ARMED_HANDLE_PX,
        left,
        width,
      }}
    >
      <span className="h-0.5 w-5 rounded-full bg-accent" />
    </span>
  );
}
