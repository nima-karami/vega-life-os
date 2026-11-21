import { describe, expect, it } from "vitest";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import { planCreateReview, planUpdateReview } from "../ops/review-ops";
import { computeZonedClock } from "../zoned-clock";

const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-20T18:00:00Z"));

const reviewsOf = (periods: Record<string, string>): LoadedDataset => ({
  reviews: createLoadedCollection(
    Object.entries(periods).map(([id, periodKey]) => ({
      row: {
        id,
        periodKey,
        prompts: [{ q: "win?", a: "old" }],
        checkIns: [],
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
        fieldUpdatedAt: {},
      },
      updateTime: `rev@${id}`,
    })),
  ),
});

const reviewFields = (periodKey: string) => ({
  fields: { periodKey, prompts: [{ q: "win?", a: "new" }] },
  ignoredKeys: [],
});

describe("planCreateReview", () => {
  it("creates under rv_<periodKey>", () => {
    const outcome = planCreateReview(reviewsOf({}), reviewFields("2026-11-16"), undefined, clock);
    expect(outcome.result.record).toMatchObject({ id: "rv_2026-11-16", createdAt: clock.nowIso });
    expect(outcome.changeSet.operations[0].expect).toEqual({ absent: true });
  });

  it("updates the review already holding the period, keeping its id", () => {
    const outcome = planCreateReview(
      reviewsOf({ rv_legacy: "2026-11-16" }),
      reviewFields("2026-11-16"),
      undefined,
      clock,
    );
    expect(outcome.result.record).toMatchObject({
      id: "rv_legacy",
      prompts: [{ q: "win?", a: "new" }],
    });
    expect(outcome.changeSet.operations[0].expect).toEqual({ updateTime: "rev@rv_legacy" });
  });

  it("refuses an explicit id on another row's period", () => {
    expect(() =>
      planCreateReview(
        reviewsOf({ rv_legacy: "2026-11-16" }),
        reviewFields("2026-11-16"),
        "rv_mine",
        clock,
      ),
    ).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
});

describe("planUpdateReview", () => {
  it("refuses moving a review onto an occupied period", () => {
    const dataset = reviewsOf({ rv_a: "2026-11-09", rv_b: "2026-11-16" });
    expect(() =>
      planUpdateReview(dataset, "rv_b", { fields: { periodKey: "2026-11-09" }, ignoredKeys: [] }),
    ).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
});

describe("review period keys", () => {
  it.each([
    "2026-11-18",
    "2026 W47",
    "2026-11-16 ",
  ])("refuses %j, which isn't a week's Monday", (periodKey) => {
    expect(() =>
      planCreateReview(reviewsOf({}), reviewFields(periodKey), undefined, clock),
    ).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST", message: expect.stringContaining("Monday") }),
    );
  });

  it("checks the period key again when an update moves it", () => {
    expect(() =>
      planUpdateReview(reviewsOf({ rv_a: "2026-11-09" }), "rv_a", {
        fields: { periodKey: "x y" },
        ignoredKeys: [],
      }),
    ).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });
});
