import { describe, expect, it } from "vitest";
import { LONG_PRESS_MS } from "@/core/ui/press-pointer";
import {
  hasEscapedPressTolerance,
  isPressablePointer,
  PRESS_MOVE_TOLERANCE_PX,
} from "../long-press";

describe("isPressablePointer", () => {
  it("arms for a primary touch", () => {
    expect(isPressablePointer({ pointerType: "touch", isPrimary: true })).toBe(true);
  });

  it("arms for a primary pen", () => {
    expect(isPressablePointer({ pointerType: "pen", isPrimary: true })).toBe(true);
  });

  it("stays disabled for the mouse — right-click is the desktop route to the sheet", () => {
    expect(isPressablePointer({ pointerType: "mouse", isPrimary: true })).toBe(false);
  });

  it("ignores a second finger, so it can neither re-arm the timer nor reset tap suppression", () => {
    expect(isPressablePointer({ pointerType: "touch", isPrimary: false })).toBe(false);
  });
});

describe("hasEscapedPressTolerance", () => {
  const origin = { x: 100, y: 200 };

  it("holds inside the tolerance", () => {
    expect(hasEscapedPressTolerance(origin, { x: 109, y: 200 })).toBe(false);
    expect(hasEscapedPressTolerance(origin, { x: 100, y: 200 })).toBe(false);
  });

  it("escapes exactly at the tolerance", () => {
    expect(hasEscapedPressTolerance(origin, { x: 100 + PRESS_MOVE_TOLERANCE_PX, y: 200 })).toBe(
      true,
    );
  });

  it("measures diagonally, not per axis", () => {
    expect(hasEscapedPressTolerance(origin, { x: 108, y: 208 })).toBe(true);
    expect(hasEscapedPressTolerance(origin, { x: 107, y: 207 })).toBe(false);
  });
});

describe("LONG_PRESS_MS", () => {
  it("stays at the existing 500ms hold", () => {
    expect(LONG_PRESS_MS).toBe(500);
  });
});
