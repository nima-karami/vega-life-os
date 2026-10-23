import type { ReactNode } from "react";

/** One windowed item, behind the space a kept focused row left between it and its neighbour. */
export function WindowSlot({ gapPx, children }: { gapPx: number; children: ReactNode }) {
  return (
    <>
      {gapPx > 0 && <div aria-hidden="true" style={{ height: gapPx }} />}
      {children}
    </>
  );
}
