import { describe, expect, it } from "vitest";
import { isTouchPress, pressSourceOf } from "../press-pointer";

describe("pressSourceOf", () => {
  it("owns a press a finger made", () => {
    expect(pressSourceOf("touch")).toBe("touch");
  });

  it("owns a pen press, which behaves as a touch does", () => {
    expect(pressSourceOf("pen")).toBe("touch");
  });

  it("disowns a mouse press", () => {
    expect(pressSourceOf("mouse")).toBe("mouse");
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
