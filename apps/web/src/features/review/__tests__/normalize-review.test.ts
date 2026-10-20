import { describe, expect, it } from "vitest";
import { normalizeReview, type Review } from "../model";

describe("normalizeReview", () => {
  it("gives a legacy review with a stored completion an empty checkIns", () => {
    const legacy = { id: "r", periodKey: "2026-06-08", prompts: [], completion: 0.8 } as never;
    expect(normalizeReview(legacy).checkIns).toEqual([]);
  });

  it("keeps stored check-ins", () => {
    const review = { id: "r", checkIns: [{ valueId: "v1", rating: 4 }] } as Review;
    expect(normalizeReview(review).checkIns).toEqual([{ valueId: "v1", rating: 4 }]);
  });
});
