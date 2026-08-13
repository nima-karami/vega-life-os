import { useRef } from "react";
import type { ColumnWidths, ResizableColumn } from "./column-widths";

const KEYBOARD_STEP_PX = 16;

/**
 * The divider is the handle. It captures the pointer so a drag keeps tracking when it
 * outruns the 9px hit area, and takes arrow keys so it is not mouse-only.
 */
export function ColumnResizer({
  column,
  widths,
  onResize,
}: {
  column: ResizableColumn;
  widths: ColumnWidths;
  onResize: (column: ResizableColumn, next: number) => void;
}) {
  const originRef = useRef<{ x: number; width: number } | null>(null);

  return (
    <button
      type="button"
      aria-label={`Resize ${column} column`}
      className="-right-[5px] absolute inset-y-0 z-10 w-[9px] cursor-col-resize touch-none outline-none focus-visible:bg-accent/30"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        originRef.current = { x: event.clientX, width: widths[column] };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const origin = originRef.current;
        if (origin === null) return;
        onResize(column, origin.width + (event.clientX - origin.x));
      }}
      onPointerUp={(event) => {
        originRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        originRef.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -KEYBOARD_STEP_PX : KEYBOARD_STEP_PX;
        onResize(column, widths[column] + delta);
      }}
    />
  );
}
