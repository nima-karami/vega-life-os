import { describe, expect, it } from "vitest";
import { describeRecallInterval, offersPromotion } from "../feed-steps";
import { buildCard } from "./fixtures";

const TODAY = "2026-08-11";

describe("offersPromotion", () => {
  it("offers it on the non-folding learnable types", () => {
    expect(offersPromotion(buildCard({ type: "quote" }))).toBe(true);
    expect(offersPromotion(buildCard({ type: "excerpt" }))).toBe(true);
    expect(offersPromotion(buildCard({ type: "fact" }))).toBe(true);
  });

  it("does not offer it to a card that already folds", () => {
    expect(offersPromotion(buildCard({ type: "note" }))).toBe(false);
    expect(offersPromotion(buildCard({ type: "vocabulary" }))).toBe(false);
  });

  it("never offers it on a prompt", () => {
    expect(offersPromotion(buildCard({ type: "prompt" }))).toBe(false);
  });

  it("does not offer it twice", () => {
    expect(offersPromotion(buildCard({ type: "quote", hasRecall: true }))).toBe(false);
  });

  it("still offers it on an untitled card, because that row is how the title gets fixed", () => {
    expect(offersPromotion(buildCard({ type: "quote", title: "" }))).toBe(true);
  });
});

describe("describeRecallInterval", () => {
  it("reads the interval out of the Leitner table, not out of new numbers", () => {
    expect(describeRecallInterval(1, true, TODAY)).toBe("in 2 days");
    expect(describeRecallInterval(2, true, TODAY)).toBe("in 4 days");
    expect(describeRecallInterval(3, true, TODAY)).toBe("in 8 days");
    expect(describeRecallInterval(4, true, TODAY)).toBe("in 16 days");
  });

  it("holds at the top box", () => {
    expect(describeRecallInterval(5, true, TODAY)).toBe("in 16 days");
  });

  it("keeps a wrong answer due today, from any box", () => {
    for (const box of [1, 2, 3, 4, 5])
      expect(describeRecallInterval(box, false, TODAY)).toBe("today");
  });
});
