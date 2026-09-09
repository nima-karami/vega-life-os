import { describe, expect, it } from "vitest";
import { isTouchPress, pressSourceOf } from "../press-pointer";

describe("pressSourceOf", () => {
  it("owns a press a finger made at either width", () => {
    expect(pressSourceOf("touch", true)).toBe("touch");
    expect(pressSourceOf("touch", false)).toBe("touch");
  });

  it("owns a pen press on a compact viewport, where it aims like a finger", () => {
    expect(pressSourceOf("pen", true)).toBe("touch");
  });

  it("disowns a pen press past sm, where it hovers and aims like a mouse", () => {
    expect(pressSourceOf("pen", false)).toBe("mouse");
  });

  it("disowns a mouse press at either width", () => {
    expect(pressSourceOf("mouse", true)).toBe("mouse");
    expect(pressSourceOf("mouse", false)).toBe("mouse");
  });
});

describe("isTouchPress", () => {
  it("gives a touch-opened menu its dismiss scrim", () => {
    expect(isTouchPress("touch")).toBe(true);
  });

  it("leaves a right-clicked menu without one", () => {
    expect(isTouchPress("mouse")).toBe(false);
  });

  it("leaves a keyboard-invoked menu without one, however long ago the last touch was", () => {
    expect(isTouchPress("none")).toBe(false);
  });
});
