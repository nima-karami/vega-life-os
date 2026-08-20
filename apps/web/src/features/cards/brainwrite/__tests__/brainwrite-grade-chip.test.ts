import { describe, expect, it } from "vitest";
import { formatGradeChip } from "../BrainWriteGradeChip";

const TODAY = "2026-08-20";

describe("formatGradeChip", () => {
  it("advances the box and reads its interval on a correct grade", () => {
    expect(formatGradeChip(3, true, TODAY)).toBe("Box 4 · next in 8 days");
  });

  it("resets to box 1, due today, on a wrong grade", () => {
    expect(formatGradeChip(3, false, TODAY)).toBe("Box 1 · next today");
  });

  it("caps at box 5 when already at the ceiling", () => {
    expect(formatGradeChip(5, true, TODAY)).toBe("Box 5 · next in 16 days");
  });

  it("reads tomorrow for a box 0 to 1 correct grade", () => {
    expect(formatGradeChip(0, true, TODAY)).toBe("Box 1 · next tomorrow");
  });
});
