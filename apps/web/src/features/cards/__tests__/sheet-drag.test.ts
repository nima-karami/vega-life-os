import { describe, expect, it } from "vitest";
import { decideSheetDrag, SHEET_DISMISS_HEIGHT_RATIO, SHEET_DISMISS_VELOCITY } from "../sheet-drag";

const SHEET_HEIGHT = 400;

describe("decideSheetDrag", () => {
  it("springs back when the drag barely moves", () => {
    expect(decideSheetDrag(10, 0, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("dismisses once the offset reaches the height ratio threshold", () => {
    const offset = SHEET_HEIGHT * SHEET_DISMISS_HEIGHT_RATIO;
    expect(decideSheetDrag(offset, 0, SHEET_HEIGHT)).toBe("dismiss");
  });

  it("springs back just under the height ratio threshold", () => {
    const offset = SHEET_HEIGHT * SHEET_DISMISS_HEIGHT_RATIO - 1;
    expect(decideSheetDrag(offset, 0, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("dismisses on a fast downward flick even with a small offset", () => {
    expect(decideSheetDrag(5, SHEET_DISMISS_VELOCITY, SHEET_HEIGHT)).toBe("dismiss");
  });

  it("springs back just under the dismiss velocity", () => {
    expect(decideSheetDrag(5, SHEET_DISMISS_VELOCITY - 1, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("springs back when the offset is zero or negative (never dismiss on an upward drag)", () => {
    expect(decideSheetDrag(0, SHEET_DISMISS_VELOCITY, SHEET_HEIGHT)).toBe("spring-back");
    expect(decideSheetDrag(-50, SHEET_DISMISS_VELOCITY, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("springs back when the sheet height is unknown (zero or negative)", () => {
    expect(decideSheetDrag(500, SHEET_DISMISS_VELOCITY, 0)).toBe("spring-back");
    expect(decideSheetDrag(500, SHEET_DISMISS_VELOCITY, -10)).toBe("spring-back");
  });
});
