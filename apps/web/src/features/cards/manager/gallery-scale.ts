/** The design stage every card face is laid out for, before a surface scales it. */
export const CARD_STAGE_WIDTH_PX = 390;

/** Per-property scale, not a CSS transform — CardFace multiplies each size and floors small text. */
export function deriveGalleryScale(tileWidthPx: number): number {
  return tileWidthPx > 0 ? tileWidthPx / CARD_STAGE_WIDTH_PX : 0;
}
