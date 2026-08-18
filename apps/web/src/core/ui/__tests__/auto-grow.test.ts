import { describe, expect, it } from "vitest";
import { computeGrownHeight } from "../auto-grow";

describe("computeGrownHeight", () => {
  it("adds the border-box adjustment to the content height", () => {
    expect(computeGrownHeight(26, 1)).toBe(27);
  });

  it("returns the content height unchanged when there is no border or padding", () => {
    expect(computeGrownHeight(26, 0)).toBe(26);
  });

  it("compensates a border on both edges", () => {
    expect(computeGrownHeight(56, 2)).toBe(58);
  });
});
