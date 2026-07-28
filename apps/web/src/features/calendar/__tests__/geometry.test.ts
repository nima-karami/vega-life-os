import { describe, expect, it } from "vitest";
import {
  clampStart,
  DAY_END,
  DAY_START,
  DROP_DURATION,
  dropToSchedule,
  formatMinutes,
  GUTTER,
  getChipHeight,
  getChipTop,
  getColumnIndexAt,
  getMarqueeHits,
  getMinuteAtOffset,
  HOUR_PX,
  isOffWindow,
  layoutColumns,
  MIN_CHIP_PX,
  resolveDrag,
  resolveDropZone,
  SNAP,
  shiftSelection,
  snap,
} from "../geometry";

describe("snap", () => {
  it("rounds minutes to the SNAP granularity", () => {
    expect(snap(0)).toBe(0);
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(SNAP);
    expect(snap(22)).toBe(15);
    expect(snap(23)).toBe(30);
  });
});

describe("clampStart", () => {
  it("keeps a start time within the visible window", () => {
    expect(clampStart(DAY_START - 60)).toBe(DAY_START);
    expect(clampStart(DAY_END)).toBe(DAY_END - SNAP);
    expect(clampStart(9 * 60)).toBe(9 * 60);
  });
});

describe("getChipTop", () => {
  it("maps a start minute to a pixel offset from the window top", () => {
    expect(getChipTop(DAY_START)).toBe(0);
    expect(getChipTop(DAY_START + 60)).toBe(HOUR_PX);
    expect(getChipTop(DAY_START + 30)).toBe(HOUR_PX / 2);
  });
  it("clamps an off-window (early) start to the top edge", () => {
    expect(getChipTop(DAY_START - 120)).toBe(0);
  });
});

describe("getChipHeight", () => {
  it("scales duration to pixels and reserves a 2px gap", () => {
    expect(getChipHeight(60)).toBe(HOUR_PX - 2);
    expect(getChipHeight(120)).toBe(HOUR_PX * 2 - 2);
  });
  it("never shrinks below the minimum tappable height", () => {
    expect(getChipHeight(1)).toBe(MIN_CHIP_PX);
    expect(getChipHeight(5)).toBe(MIN_CHIP_PX);
  });
});

describe("isOffWindow", () => {
  it("flags timed tasks that fall outside 05:00–23:00", () => {
    expect(isOffWindow(4 * 60)).toBe(true);
    expect(isOffWindow(23 * 60 + 30)).toBe(true);
    expect(isOffWindow(DAY_START)).toBe(false);
    expect(isOffWindow(12 * 60)).toBe(false);
  });
});

describe("formatMinutes", () => {
  it("formats minutes-since-midnight as HH:mm", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(9 * 60 + 5)).toBe("09:05");
    expect(formatMinutes(23 * 60 + 59)).toBe("23:59");
  });
});

describe("getMinuteAtOffset", () => {
  it("converts a pixel offset into a snapped, clamped start minute", () => {
    expect(getMinuteAtOffset(0)).toBe(DAY_START);
    expect(getMinuteAtOffset(HOUR_PX)).toBe(DAY_START + 60);
    // negative offset clamps to window start
    expect(getMinuteAtOffset(-100)).toBe(DAY_START);
    // far below clamps to last slot
    expect(getMinuteAtOffset(HOUR_PX * 100)).toBe(DAY_END - SNAP);
  });
});

describe("dropToSchedule", () => {
  it("schedules a fixed 60-minute block at the snapped drop minute", () => {
    expect(dropToSchedule(HOUR_PX)).toEqual({
      startMin: DAY_START + 60,
      durationMin: DROP_DURATION,
    });
  });
  it("clamps so a 60-min block near the day's end stays inside the window", () => {
    expect(dropToSchedule(HOUR_PX * 100).startMin).toBe(DAY_END - DROP_DURATION);
  });
  it("clamps an above-window drop to the window start", () => {
    expect(dropToSchedule(-100)).toEqual({ startMin: DAY_START, durationMin: DROP_DURATION });
  });
});

describe("getMarqueeHits", () => {
  const boxes = [
    { id: "a", left: 0, top: 0, right: 10, bottom: 10 },
    { id: "b", left: 50, top: 50, right: 60, bottom: 60 },
    { id: "c", left: 100, top: 100, right: 110, bottom: 110 },
  ];
  it("returns ids of chips intersecting the rect", () => {
    expect(getMarqueeHits({ left: 5, top: 5, right: 55, bottom: 55 }, boxes)).toEqual(["a", "b"]);
  });
  it("returns nothing when the rect hits no chip", () => {
    expect(getMarqueeHits({ left: 200, top: 200, right: 300, bottom: 300 }, boxes)).toEqual([]);
  });
  it("counts edge-touching as a miss (strict overlap)", () => {
    // rect right edge at x=0 exactly touches box a's left edge → no overlap
    expect(getMarqueeHits({ left: -10, top: -10, right: 0, bottom: 0 }, boxes)).toEqual([]);
  });
});

describe("shiftSelection", () => {
  const items = [
    { id: "a", date: "2026-06-22", start: 9 * 60, durationMin: 60 },
    { id: "b", date: "2026-06-22", start: 10 * 60, durationMin: 30 },
  ];
  it("shifts every item by the same day and minute delta", () => {
    expect(shiftSelection(items, 1, 60)).toEqual([
      { id: "a", date: "2026-06-23", start: 10 * 60 },
      { id: "b", date: "2026-06-23", start: 11 * 60 },
    ]);
  });
  it("clamps each item by its own duration at the window edge", () => {
    const r = shiftSelection(items, 0, 10_000);
    expect(r[0].start).toBe(DAY_END - 60);
    expect(r[1].start).toBe(DAY_END - 30);
  });
  it("clamps to the window start when shifted before 05:00", () => {
    expect(shiftSelection(items, 0, -10_000).every((x) => x.start === DAY_START)).toBe(true);
  });
});

describe("layoutColumns", () => {
  it("gives a lone event the full width", () => {
    expect(layoutColumns([{ id: "a", start: 9 * 60, durationMin: 60 }])).toEqual({
      a: { col: 0, cols: 1 },
    });
  });
  it("keeps back-to-back (non-overlapping) events full width", () => {
    const r = layoutColumns([
      { id: "a", start: 9 * 60, durationMin: 60 },
      { id: "b", start: 10 * 60, durationMin: 60 },
    ]);
    expect(r).toEqual({ a: { col: 0, cols: 1 }, b: { col: 0, cols: 1 } });
  });
  it("splits two overlapping events into two side-by-side columns", () => {
    const r = layoutColumns([
      { id: "a", start: 9 * 60, durationMin: 60 },
      { id: "b", start: 9 * 60 + 30, durationMin: 60 },
    ]);
    expect(r).toEqual({ a: { col: 0, cols: 2 }, b: { col: 1, cols: 2 } });
  });
  it("treats same-start zero-duration events as overlapping", () => {
    const r = layoutColumns([
      { id: "a", start: 9 * 60, durationMin: 0 },
      { id: "b", start: 9 * 60, durationMin: 0 },
    ]);
    expect(r).toEqual({ a: { col: 0, cols: 2 }, b: { col: 1, cols: 2 } });
  });
  it("reuses a freed column after an earlier event ends within the cluster", () => {
    // a 9:00–11:00 overlaps b 9:30–10:00 and c 10:00–11:00; b ends as c starts,
    // so c reuses b's column → cluster width is 2, not 3.
    const r = layoutColumns([
      { id: "a", start: 9 * 60, durationMin: 120 },
      { id: "b", start: 9 * 60 + 30, durationMin: 30 },
      { id: "c", start: 10 * 60, durationMin: 60 },
    ]);
    expect(r.a).toEqual({ col: 0, cols: 2 });
    expect(r.b).toEqual({ col: 1, cols: 2 });
    expect(r.c).toEqual({ col: 1, cols: 2 });
  });
  it("keeps two separate clusters independent", () => {
    const r = layoutColumns([
      { id: "a", start: 9 * 60, durationMin: 60 },
      { id: "b", start: 9 * 60 + 30, durationMin: 60 },
      { id: "c", start: 14 * 60, durationMin: 60 },
    ]);
    expect(r.a.cols).toBe(2);
    expect(r.b.cols).toBe(2);
    expect(r.c).toEqual({ col: 0, cols: 1 });
  });
});

describe("resolveDrag", () => {
  const base = { origDate: "2026-06-17", origStart: 9 * 60, origDur: 60 };

  it("move: shifts to the target day and snapped start, keeping duration", () => {
    const r = resolveDrag("move", base, {
      pointerMin: 10 * 60 + 7,
      grabMin: 0,
      targetDate: "2026-06-18",
    });
    expect(r).toEqual({ date: "2026-06-18", start: 10 * 60, durationMin: 60 });
  });

  it("move: clamps so the block stays fully inside the window", () => {
    const r = resolveDrag("move", base, {
      pointerMin: DAY_END + 200,
      grabMin: 0,
      targetDate: "2026-06-17",
    });
    expect(r.start).toBe(DAY_END - base.origDur);
    expect(r.durationMin).toBe(60);
  });

  it("move: accounts for the grab offset within the block", () => {
    const r = resolveDrag("move", base, {
      pointerMin: 10 * 60 + 30,
      grabMin: 30,
      targetDate: "2026-06-17",
    });
    expect(r.start).toBe(10 * 60);
  });

  it("bottom: resizes duration down to the snapped end, min one slot", () => {
    const r = resolveDrag("bottom", base, {
      pointerMin: 10 * 60 + 30,
      grabMin: 0,
      targetDate: "2026-06-17",
    });
    expect(r).toEqual({ date: "2026-06-17", start: 9 * 60, durationMin: 90 });
  });

  it("bottom: never collapses below one SNAP slot", () => {
    const r = resolveDrag("bottom", base, {
      pointerMin: 8 * 60,
      grabMin: 0,
      targetDate: "2026-06-17",
    });
    expect(r.durationMin).toBe(SNAP);
  });

  it("top: drags the start earlier while holding the end fixed", () => {
    const r = resolveDrag("top", base, {
      pointerMin: 8 * 60 + 30,
      grabMin: 0,
      targetDate: "2026-06-17",
    });
    expect(r).toEqual({ date: "2026-06-17", start: 8 * 60 + 30, durationMin: 90 });
  });

  it("top: cannot cross the fixed end (keeps at least one slot)", () => {
    const r = resolveDrag("top", base, {
      pointerMin: 12 * 60,
      grabMin: 0,
      targetDate: "2026-06-17",
    });
    expect(r.start).toBe(base.origStart + base.origDur - SNAP);
    expect(r.durationMin).toBe(SNAP);
  });
});

describe("resolveDropZone", () => {
  it("stays untimed while the pointer is above the all-day row's bottom edge", () => {
    expect(resolveDropZone(-200, "untimed")).toBe("untimed");
    expect(resolveDropZone(-1, "untimed")).toBe("untimed");
  });
  it("holds the untimed zone inside the hysteresis band", () => {
    expect(resolveDropZone(3, "untimed")).toBe("untimed");
  });
  it("flips to timed at the band edge and below the grid", () => {
    expect(resolveDropZone(4, "untimed")).toBe("timed");
    expect(resolveDropZone(5000, "untimed")).toBe("timed");
  });
  it("holds the timed zone until the pointer clears the band symmetrically", () => {
    expect(resolveDropZone(-3, "timed")).toBe("timed");
    expect(resolveDropZone(-4, "timed")).toBe("untimed");
    expect(resolveDropZone(-5, "timed")).toBe("untimed");
  });
});

describe("getColumnIndexAt", () => {
  const box = { left: 0, width: GUTTER + 700 };
  it("maps a pointer X to its day column past the gutter", () => {
    expect(getColumnIndexAt(GUTTER + 1, box, 7)).toBe(0);
    expect(getColumnIndexAt(GUTTER + 150, box, 7)).toBe(1);
    expect(getColumnIndexAt(GUTTER + 699, box, 7)).toBe(6);
  });
  it("clamps a pointer left of the gutter to the first column", () => {
    expect(getColumnIndexAt(-500, box, 7)).toBe(0);
  });
  it("clamps a pointer past the last column to the last column", () => {
    expect(getColumnIndexAt(GUTTER + 5000, box, 7)).toBe(6);
  });
  it("resolves everything to column 0 on a single-column (compact) grid", () => {
    expect(getColumnIndexAt(GUTTER + 400, box, 1)).toBe(0);
  });
  it("is offset by the box's own left origin", () => {
    expect(getColumnIndexAt(300 + GUTTER + 150, { left: 300, width: GUTTER + 700 }, 7)).toBe(1);
  });
});
