import { describe, expect, it } from "vitest";
import {
  decideSheetDrag,
  nextSheetDetent,
  SHEET_DETENT_HEIGHT_RATIO,
  SHEET_DETENT_VELOCITY,
} from "../sheet-drag";

const SHEET_HEIGHT = 400;
const THRESHOLD_PX = SHEET_HEIGHT * SHEET_DETENT_HEIGHT_RATIO;

describe("decideSheetDrag", () => {
  it("springs back when the drag barely moves", () => {
    expect(decideSheetDrag("default", 10, 0, SHEET_HEIGHT)).toBe("spring-back");
    expect(decideSheetDrag("expanded", -10, 0, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("dismisses from the default detent once the offset reaches the height ratio", () => {
    expect(decideSheetDrag("default", THRESHOLD_PX, 0, SHEET_HEIGHT)).toBe("dismiss");
  });

  it("springs back just under the height ratio threshold", () => {
    expect(decideSheetDrag("default", THRESHOLD_PX - 1, 0, SHEET_HEIGHT)).toBe("spring-back");
    expect(decideSheetDrag("default", -(THRESHOLD_PX - 1), 0, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("dismisses from the default detent on a fast downward flick", () => {
    expect(decideSheetDrag("default", 5, SHEET_DETENT_VELOCITY, SHEET_HEIGHT)).toBe("dismiss");
  });

  it("springs back just under the dismiss velocity", () => {
    expect(decideSheetDrag("default", 5, SHEET_DETENT_VELOCITY - 1, SHEET_HEIGHT)).toBe(
      "spring-back",
    );
  });

  it("expands from the default detent past the upward distance threshold", () => {
    expect(decideSheetDrag("default", -THRESHOLD_PX, 0, SHEET_HEIGHT)).toBe("expand");
  });

  it("expands from the default detent on a strong upward fling", () => {
    expect(decideSheetDrag("default", -5, -SHEET_DETENT_VELOCITY, SHEET_HEIGHT)).toBe("expand");
  });

  it("springs back just under the upward fling velocity", () => {
    expect(decideSheetDrag("default", -5, -(SHEET_DETENT_VELOCITY - 1), SHEET_HEIGHT)).toBe(
      "spring-back",
    );
  });

  it("collapses to the default detent rather than dismissing when expanded", () => {
    expect(decideSheetDrag("expanded", THRESHOLD_PX, 0, SHEET_HEIGHT)).toBe("collapse");
    expect(decideSheetDrag("expanded", 5, SHEET_DETENT_VELOCITY, SHEET_HEIGHT)).toBe("collapse");
    expect(decideSheetDrag("expanded", SHEET_HEIGHT, 4000, SHEET_HEIGHT)).toBe("collapse");
  });

  it("never expands past the expanded detent", () => {
    expect(decideSheetDrag("expanded", -SHEET_HEIGHT, -4000, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("springs back on a still pointer", () => {
    expect(decideSheetDrag("default", 0, SHEET_DETENT_VELOCITY, SHEET_HEIGHT)).toBe("spring-back");
    expect(decideSheetDrag("expanded", 0, SHEET_DETENT_VELOCITY, SHEET_HEIGHT)).toBe("spring-back");
  });

  it("springs back when the sheet height is unknown (zero or negative)", () => {
    expect(decideSheetDrag("default", 500, SHEET_DETENT_VELOCITY, 0)).toBe("spring-back");
    expect(decideSheetDrag("default", 500, SHEET_DETENT_VELOCITY, -10)).toBe("spring-back");
  });
});

describe("nextSheetDetent", () => {
  it("moves between the two detents on expand and collapse", () => {
    expect(nextSheetDetent("default", "expand")).toBe("expanded");
    expect(nextSheetDetent("expanded", "collapse")).toBe("default");
  });

  it("keeps the current detent on spring-back and dismiss", () => {
    expect(nextSheetDetent("expanded", "spring-back")).toBe("expanded");
    expect(nextSheetDetent("default", "spring-back")).toBe("default");
    expect(nextSheetDetent("default", "dismiss")).toBe("default");
  });
});
