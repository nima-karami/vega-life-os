import { describe, expect, it } from "vitest";
import {
  chunkIntoRows,
  computeSpacers,
  deriveGalleryColumns,
  estimateGalleryRowPx,
  includeFocusedIndex,
} from "../manager/virtual-window";

describe("includeFocusedIndex — the row holding focus never unmounts", () => {
  it("leaves the window alone when nothing in it is focused", () => {
    expect(includeFocusedIndex([4, 5, 6], null, 100)).toEqual([4, 5, 6]);
  });

  it("leaves the window alone when the focused row is already in it", () => {
    expect(includeFocusedIndex([4, 5, 6], 5, 100)).toEqual([4, 5, 6]);
  });

  it("keeps a focused row scrolled out above or below, in index order", () => {
    expect(includeFocusedIndex([40, 41, 42], 2, 100)).toEqual([2, 40, 41, 42]);
    expect(includeFocusedIndex([0, 1, 2], 90, 100)).toEqual([0, 1, 2, 90]);
  });

  it("drops a focused index the list no longer holds", () => {
    expect(includeFocusedIndex([0, 1], 7, 5)).toEqual([0, 1]);
  });
});

describe("computeSpacers — the scroll height stays the full list's", () => {
  it("is zero either side when the whole list renders", () => {
    const items = [
      { start: 100, end: 144 },
      { start: 144, end: 188 },
    ];
    expect(computeSpacers(items, 88, 100)).toEqual({ before: 0, after: 0, gaps: [0, 0] });
  });

  it("pads the rows scrolled past and the rows still to come", () => {
    const items = [
      { start: 100 + 440, end: 100 + 484 },
      { start: 100 + 484, end: 100 + 528 },
    ];
    expect(computeSpacers(items, 4400, 100)).toEqual({
      before: 440,
      after: 4400 - 528,
      gaps: [0, 0],
    });
  });

  it("collapses to nothing for an empty window", () => {
    expect(computeSpacers([], 0, 100)).toEqual({ before: 0, after: 0, gaps: [] });
  });

  it("opens a gap between a kept focused row and a window far from it", () => {
    const items = [
      { start: 100 + 88, end: 100 + 132 },
      { start: 100 + 4400, end: 100 + 4444 },
      { start: 100 + 4444, end: 100 + 4488 },
    ];
    expect(computeSpacers(items, 8800, 100)).toEqual({
      before: 88,
      after: 8800 - 4488,
      gaps: [0, 4400 - 132, 0],
    });
  });

  it("never pads below zero, whatever the measurements say", () => {
    expect(computeSpacers([{ start: 90, end: 140 }], 30, 100)).toEqual({
      before: 0,
      after: 0,
      gaps: [0],
    });
  });
});

describe("chunkIntoRows — the gallery virtualizes rows, not tiles", () => {
  it("fills each row to the column count and leaves the remainder last", () => {
    expect(chunkIntoRows([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("returns no rows for no tiles", () => {
    expect(chunkIntoRows([], 5)).toEqual([]);
  });

  it("treats a nonsense column count as one column", () => {
    expect(chunkIntoRows([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("deriveGalleryColumns — the same breakpoints the grid used", () => {
  it("is 2 on a phone, 3 below lg and 5 from lg", () => {
    expect(deriveGalleryColumns({ isCompact: true, isBelowLarge: true })).toBe(2);
    expect(deriveGalleryColumns({ isCompact: false, isBelowLarge: true })).toBe(3);
    expect(deriveGalleryColumns({ isCompact: false, isBelowLarge: false })).toBe(5);
  });
});

describe("estimateGalleryRowPx — a 390×600 tile plus the row gap", () => {
  it("scales the tile height from its width", () => {
    expect(estimateGalleryRowPx(195, 16)).toBe(300 + 16);
  });

  it("guesses a sane row before the grid is measured", () => {
    expect(estimateGalleryRowPx(0, 16)).toBeGreaterThan(16);
  });
});
