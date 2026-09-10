import { describe, expect, it } from "vitest";
import { ARMED_HANDLE_PX, getArmedHandleTop, getChipTouchActionClass } from "../chip-armed";

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

describe("getChipTouchActionClass", () => {
  it("touch-action is one class, never two", () => {
    expect(getChipTouchActionClass(true)).toBe("touch-none");
    expect(getChipTouchActionClass(false)).toBe("touch-manipulation");
  });
});
