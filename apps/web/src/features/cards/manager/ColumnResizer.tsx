import { useEffect, useRef } from "react";
import type { ColumnWidths, ResizableColumn } from "./column-widths";

const KEYBOARD_STEP_PX = 16;
const RESIZING_BODY_CLASS = "is-resizing-column";

/**
 * The divider is the handle. It captures the pointer so a drag keeps tracking when it
 * outruns the 9px hit area, and takes arrow keys so it is not mouse-only.
 */
export function ColumnResizer({
  column,
  widths,
  onResize,
  onResizeCommit,
}: {
  column: ResizableColumn;
  widths: ColumnWidths;
  onResize: (column: ResizableColumn, next: number) => void;
  onResizeCommit: (column: ResizableColumn) => void;
}) {
  const originRef = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    return () => document.body.classList.remove(RESIZING_BODY_CLASS);
  }, []);

  return (
    <button
      type="button"
      aria-label={`Resize ${column} column`}
      className="-right-[5px] absolute inset-y-0 z-10 w-[9px] cursor-col-resize touch-none outline-none focus-visible:bg-accent/30"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // The title column's track is flexible, so its rendered width usually differs
        // from its stored width — the drag origin has to be what's on screen, not state.
        const originWidth =
          column === "title"
            ? (event.currentTarget.parentElement?.getBoundingClientRect().width ?? widths[column])
            : widths[column];
        originRef.current = { x: event.clientX, width: originWidth };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.classList.add(RESIZING_BODY_CLASS);
      }}
      onPointerMove={(event) => {
        const origin = originRef.current;
        if (origin === null) return;
        onResize(column, origin.width + (event.clientX - origin.x));
      }}
      onPointerUp={(event) => {
        originRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        document.body.classList.remove(RESIZING_BODY_CLASS);
        onResizeCommit(column);
      }}
      onPointerCancel={() => {
        originRef.current = null;
        document.body.classList.remove(RESIZING_BODY_CLASS);
        onResizeCommit(column);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -KEYBOARD_STEP_PX : KEYBOARD_STEP_PX;
        onResize(column, widths[column] + delta);
        onResizeCommit(column);
      }}
    />
  );
}
