export const SHEET_DISMISS_HEIGHT_RATIO = 0.25;
export const SHEET_DISMISS_VELOCITY = 800; // px/s, downward only

export function decideSheetDrag(
  offsetY: number,
  velocityY: number,
  sheetHeightPx: number,
): "dismiss" | "spring-back" {
  if (offsetY <= 0 || sheetHeightPx <= 0) return "spring-back";
  if (offsetY / sheetHeightPx >= SHEET_DISMISS_HEIGHT_RATIO) return "dismiss";
  if (velocityY >= SHEET_DISMISS_VELOCITY) return "dismiss";
  return "spring-back";
}
