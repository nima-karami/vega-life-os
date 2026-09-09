import { describe, expect, it } from "vitest";
import { isRecentTouchPress } from "../press-pointer";

describe("isRecentTouchPress", () => {
  it("owns a menu opened while the touch that started it is still in flight", () => {
    expect(isRecentTouchPress(10_000, 10_550)).toBe(true);
  });

  it("disowns a menu opened long after the press ended, as a keyboard one is", () => {
    expect(isRecentTouchPress(10_000, 14_000)).toBe(false);
  });

  it("disowns a menu when no touch press has happened at all", () => {
    expect(isRecentTouchPress(0, 1_760_000_000_000)).toBe(false);
  });
});
