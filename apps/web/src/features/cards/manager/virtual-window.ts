import { CARD_STAGE_WIDTH_PX } from "./gallery-scale";

const CARD_STAGE_HEIGHT_PX = 600;
const UNMEASURED_TILE_WIDTH_PX = 200;

export interface WindowSpacers {
  before: number;
  after: number;
  /** space before each item past the first — only a kept focused row leaves one */
  gaps: number[];
}

export function includeFocusedIndex(
  indexes: number[],
  focusedIndex: number | null,
  count = Number.POSITIVE_INFINITY,
): number[] {
  if (focusedIndex === null || focusedIndex >= count || indexes.includes(focusedIndex)) {
    return indexes;
  }
  return [...indexes, focusedIndex].sort((a, b) => a - b);
}

/** Items carry `scrollMargin` in their offsets; the total does not. */
export function computeSpacers(
  items: readonly { start: number; end: number }[],
  totalSize: number,
  scrollMargin: number,
): WindowSpacers {
  if (items.length === 0) return { before: 0, after: 0, gaps: [] };
  const first = items[0];
  const last = items[items.length - 1];
  return {
    before: Math.max(0, first.start - scrollMargin),
    after: Math.max(0, totalSize - (last.end - scrollMargin)),
    gaps: items.map((item, index) =>
      index === 0 ? 0 : Math.max(0, item.start - items[index - 1].end),
    ),
  };
}

export function chunkIntoRows<Item>(items: readonly Item[], columns: number): Item[][] {
  const width = Math.max(1, Math.floor(columns));
  const rows: Item[][] = [];
  for (let start = 0; start < items.length; start += width) {
    rows.push(items.slice(start, start + width));
  }
  return rows;
}

export function deriveGalleryColumns(viewport: {
  isCompact: boolean;
  isBelowLarge: boolean;
}): number {
  if (viewport.isCompact) return 2;
  return viewport.isBelowLarge ? 3 : 5;
}

export function estimateGalleryRowPx(tileWidthPx: number, gapPx: number): number {
  const width = tileWidthPx > 0 ? tileWidthPx : UNMEASURED_TILE_WIDTH_PX;
  return (width * CARD_STAGE_HEIGHT_PX) / CARD_STAGE_WIDTH_PX + gapPx;
}
