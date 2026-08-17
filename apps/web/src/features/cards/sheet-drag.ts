export const SHEET_DETENT_HEIGHT_RATIO = 0.25;
export const SHEET_DETENT_VELOCITY = 800; // px/s

export type SheetDetent = "default" | "expanded";

export type SheetDragOutcome = "expand" | "collapse" | "dismiss" | "spring-back";

export function decideSheetDrag(
  detent: SheetDetent,
  offsetY: number,
  velocityY: number,
  sheetHeightPx: number,
): SheetDragOutcome {
  if (offsetY === 0 || sheetHeightPx <= 0) return "spring-back";
  const passedDistance = Math.abs(offsetY) / sheetHeightPx >= SHEET_DETENT_HEIGHT_RATIO;
  if (offsetY < 0) {
    if (detent === "expanded") return "spring-back";
    return passedDistance || -velocityY >= SHEET_DETENT_VELOCITY ? "expand" : "spring-back";
  }
  if (!passedDistance && velocityY < SHEET_DETENT_VELOCITY) return "spring-back";
  return detent === "expanded" ? "collapse" : "dismiss";
}

export function nextSheetDetent(detent: SheetDetent, outcome: SheetDragOutcome): SheetDetent {
  if (outcome === "expand") return "expanded";
  if (outcome === "collapse") return "default";
  return detent;
}
