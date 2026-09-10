import { describe, expect, it } from "vitest";
import {
  ARMED_CHIP_CLASS,
  ARMED_HANDLE_PX,
  type ChipState,
  getArmedHandleTop,
  getChipCursorClass,
  getChipRingClass,
  getChipShadowClass,
  getChipTouchActionClass,
  getChipZIndexClass,
} from "../chip-armed";

describe("getArmedHandleTop", () => {
  it("a tall chip's handles straddle its edges", () => {
    expect(getArmedHandleTop("top", 100, 60)).toBe(84);
    expect(getArmedHandleTop("bottom", 100, 60)).toBe(152);
  });

  it("a short chip's handles clear the box entirely", () => {
    expect(getArmedHandleTop("top", 100, 30)).toBe(76);
    expect(getArmedHandleTop("bottom", 100, 30)).toBe(130);
  });

  it("the straddle boundary is exclusive at 40px", () => {
    expect(getArmedHandleTop("top", 100, 40)).toBe(76);
    expect(getArmedHandleTop("bottom", 100, 40)).toBe(140);
    expect(getArmedHandleTop("top", 100, 41)).toBe(84);
  });

  it("a handle never covers less than its own hit area", () => {
    expect(ARMED_HANDLE_PX).toBe(24);
    for (const height of [20, 34, 40, 41, 92]) {
      const gap = getArmedHandleTop("bottom", 0, height) - getArmedHandleTop("top", 0, height);
      expect(gap).toBeGreaterThanOrEqual(ARMED_HANDLE_PX);
    }
  });
});

describe("getChipShadowClass", () => {
  it("the shadow is one class, never two", () => {
    expect(getChipShadowClass(true)).toBe("shadow-md");
    expect(getChipShadowClass(false)).toBe("shadow-sm");
  });

  it("no other chip class emits a shadow, so exactly one can land", () => {
    expect(ARMED_CHIP_CLASS).not.toMatch(/\bshadow-/);
  });
});

describe("getChipTouchActionClass", () => {
  it("touch-action is one class, never two", () => {
    expect(getChipTouchActionClass(true)).toBe("touch-none");
    expect(getChipTouchActionClass(false)).toBe("touch-manipulation");
  });
});

type ChipRingFlag = "isArmed" | "isSelected" | "isProvisional" | "isDragging";
const RING_FLAGS: ChipRingFlag[] = ["isArmed", "isSelected", "isProvisional", "isDragging"];

const ringClassFor = (on: ChipRingFlag[]) =>
  getChipRingClass({
    isArmed: on.includes("isArmed"),
    isSelected: on.includes("isSelected"),
    isProvisional: on.includes("isProvisional"),
    isDragging: on.includes("isDragging"),
  });

describe("getChipRingClass", () => {
  it("an armed chip keeps its ring for the whole drag", () => {
    expect(ringClassFor(["isArmed", "isDragging"])).toBe(ringClassFor(["isArmed"]));
    expect(ringClassFor(["isArmed"])).toContain("ring-offset-1");
  });

  it("the ring is one class, never two, for every pair of states", () => {
    for (const first of RING_FLAGS) {
      for (const second of RING_FLAGS) {
        const widths = ringClassFor([first, second]).match(/\bring-\d\b/g) ?? [];
        expect(widths, `${first} + ${second}`).toHaveLength(1);
      }
    }
  });

  it("an idle chip wears no ring", () => {
    expect(ringClassFor([])).toBe("");
  });
});

const EVERY_CHIP_STATE = [false, true].flatMap((isArmed) =>
  [false, true].flatMap((isSelected) =>
    [false, true].flatMap((isProvisional) =>
      [false, true].map((isDragging) => ({ isArmed, isSelected, isProvisional, isDragging })),
    ),
  ),
);

const chipStateWith = (on: Partial<ChipState>): ChipState => ({
  isArmed: false,
  isSelected: false,
  isProvisional: false,
  isDragging: false,
  ...on,
});

describe("getChipZIndexClass", () => {
  it("the z-index is one class, never two, in every state", () => {
    for (const state of EVERY_CHIP_STATE) {
      const levels = getChipZIndexClass(state).match(/\bz-\d+\b/g) ?? [];
      expect(levels.length, JSON.stringify(state)).toBeLessThanOrEqual(1);
    }
  });

  it("the lift outranks selection, which is the level the cascade used to pick", () => {
    expect(getChipZIndexClass(chipStateWith({ isArmed: true, isSelected: true }))).toBe("z-30");
    expect(getChipZIndexClass(chipStateWith({ isDragging: true, isProvisional: true }))).toBe(
      "z-30",
    );
    expect(getChipZIndexClass(chipStateWith({ isSelected: true }))).toBe("z-20");
  });

  it("an idle chip keeps the grid's own stacking", () => {
    expect(getChipZIndexClass(chipStateWith({}))).toBe("");
  });
});

describe("getChipCursorClass", () => {
  it("the cursor is one class, never two", () => {
    expect(getChipCursorClass(true)).toBe("cursor-grabbing");
    expect(getChipCursorClass(false)).toBe("cursor-grab");
  });

  it("no other chip class emits a z-index or a cursor, so exactly one of each lands", () => {
    for (const state of EVERY_CHIP_STATE) {
      const others = [
        getChipRingClass(state),
        getChipShadowClass(state.isArmed || state.isDragging),
        getChipTouchActionClass(state.isArmed),
      ].join(" ");
      expect(others, JSON.stringify(state)).not.toMatch(/\bz-\d+\b/);
      expect(others, JSON.stringify(state)).not.toMatch(/\bcursor-/);
    }
  });
});
