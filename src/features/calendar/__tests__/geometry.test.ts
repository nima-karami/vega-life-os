import { describe, expect, it } from "vitest";
import {
  chipHeight,
  chipTop,
  clampStart,
  DAY_END,
  DAY_START,
  DROP_DURATION,
  dropToSchedule,
  fmtMin,
  HOUR_PX,
  isOffWindow,
  MIN_CHIP_PX,
  minuteAtOffset,
  resolveDrag,
  SNAP,
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

describe("chipTop", () => {
  it("maps a start minute to a pixel offset from the window top", () => {
    expect(chipTop(DAY_START)).toBe(0);
    expect(chipTop(DAY_START + 60)).toBe(HOUR_PX);
    expect(chipTop(DAY_START + 30)).toBe(HOUR_PX / 2);
  });
  it("clamps an off-window (early) start to the top edge", () => {
    expect(chipTop(DAY_START - 120)).toBe(0);
  });
});

describe("chipHeight", () => {
  it("scales duration to pixels and reserves a 2px gap", () => {
    expect(chipHeight(60)).toBe(HOUR_PX - 2);
    expect(chipHeight(120)).toBe(HOUR_PX * 2 - 2);
  });
  it("never shrinks below the minimum tappable height", () => {
    expect(chipHeight(1)).toBe(MIN_CHIP_PX);
    expect(chipHeight(5)).toBe(MIN_CHIP_PX);
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

describe("fmtMin", () => {
  it("formats minutes-since-midnight as HH:mm", () => {
    expect(fmtMin(0)).toBe("00:00");
    expect(fmtMin(9 * 60 + 5)).toBe("09:05");
    expect(fmtMin(23 * 60 + 59)).toBe("23:59");
  });
});

describe("minuteAtOffset", () => {
  it("converts a pixel offset into a snapped, clamped start minute", () => {
    expect(minuteAtOffset(0)).toBe(DAY_START);
    expect(minuteAtOffset(HOUR_PX)).toBe(DAY_START + 60);
    // negative offset clamps to window start
    expect(minuteAtOffset(-100)).toBe(DAY_START);
    // far below clamps to last slot
    expect(minuteAtOffset(HOUR_PX * 100)).toBe(DAY_END - SNAP);
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
