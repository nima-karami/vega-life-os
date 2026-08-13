import { describe, expect, it } from "vitest";
import { canConfirmDelete, describeDeletePrompt } from "../manager/DeleteSelectionDialog";

describe("canConfirmDelete", () => {
  it("refuses anything but the word delete", () => {
    expect(canConfirmDelete("")).toBe(false);
    expect(canConfirmDelete("del")).toBe(false);
    expect(canConfirmDelete("delete this")).toBe(false);
  });

  it("accepts the word, ignoring surrounding space and case", () => {
    expect(canConfirmDelete("delete")).toBe(true);
    expect(canConfirmDelete("  Delete ")).toBe(true);
  });
});

describe("describeDeletePrompt", () => {
  it("names the full selection, including rows the filter hides", () => {
    expect(describeDeletePrompt(3)).toBe("Delete 3 cards?");
    expect(describeDeletePrompt(1)).toBe("Delete 1 card?");
  });
});
