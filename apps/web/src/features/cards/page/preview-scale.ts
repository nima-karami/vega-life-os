export const PREVIEW_CARD_W = 390;
export const PREVIEW_CARD_H = 600;

const PREVIEW_INSET_X_PX = 16;
const PREVIEW_CHROME_Y_PX = 112;

/** Largest scale at which the 390×600 face fits, never magnified past its design size. */
export function fitPreviewScale(viewportWidthPx: number, viewportHeightPx: number): number {
  const scale = Math.min(
    1,
    (viewportWidthPx - 2 * PREVIEW_INSET_X_PX) / PREVIEW_CARD_W,
    (viewportHeightPx - PREVIEW_CHROME_Y_PX) / PREVIEW_CARD_H,
  );
  return Number.isFinite(scale) && scale > 0 ? scale : 0;
}
