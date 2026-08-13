// apps/web/src/features/cards/__tests__/review-status.test.ts
import type { Card } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildReviewStatus, getReviewControlState } from "../page/review-status";

const card = (over: Partial<Card> = {}): Card =>
  ({
    id: "c_1",
    type: "vocabulary",
    category: "Language",
    title: "saudade",
    body: "A deep, nostalgic longing for something absent.",
    author: null,
    work: null,
    locator: null,
    phonetic: null,
    language: null,
    examples: [],
    synonyms: [],
    hasRecall: false,
    addedAt: "2026-08-08",
    hiddenAt: null,
    likedAt: null,
    box: 3,
    lastReviewed: "2026-08-07",
    nextDue: "2026-08-15",
    reviewCount: 7,
    updatedAt: "",
    fieldUpdatedAt: {},
    ...over,
  }) as Card;

describe("getReviewControlState", () => {
  it("greys only a type that can never be learned", () => {
    expect(getReviewControlState(card({ type: "prompt", box: null }))).toBe("neverLearnable");
  });

  it("reads a graded card as learning", () => {
    expect(getReviewControlState(card())).toBe("learning");
  });

  it("reads a folding card that is out of review as not learning", () => {
    expect(getReviewControlState(card({ box: null }))).toBe("notLearning");
  });

  it("offers promotion on a type with no reveal yet", () => {
    expect(getReviewControlState(card({ type: "quote", box: null }))).toBe("promotable");
    expect(getReviewControlState(card({ type: "quote", box: null, hasRecall: true }))).toBe(
      "notLearning",
    );
  });
});

describe("buildReviewStatus", () => {
  it("prints the full graded line on desktop", () => {
    expect(buildReviewStatus(card(), "2026-08-11", "full")).toBe(
      "Graded · box 3 · due in 4 days · 7 reviews · added Aug 8",
    );
  });

  it("drops the review count and the added date on mobile", () => {
    expect(buildReviewStatus(card(), "2026-08-11", "short")).toBe("Graded · box 3 · due in 4 days");
  });

  it("omits a review count of zero and says the card has not been graded yet", () => {
    expect(
      buildReviewStatus(card({ reviewCount: 0, lastReviewed: null }), "2026-08-11", "full"),
    ).toBe("In review · box 3 · due in 4 days · added Aug 8");
  });

  it("says today and tomorrow rather than counting zero or one day", () => {
    expect(buildReviewStatus(card({ nextDue: "2026-08-11" }), "2026-08-11", "short")).toBe(
      "Graded · box 3 · due today",
    );
    expect(buildReviewStatus(card({ nextDue: "2026-08-09" }), "2026-08-11", "short")).toBe(
      "Graded · box 3 · due today",
    );
    expect(buildReviewStatus(card({ nextDue: "2026-08-12" }), "2026-08-11", "short")).toBe(
      "Graded · box 3 · due tomorrow",
    );
  });

  it("counts one review in the singular", () => {
    expect(buildReviewStatus(card({ reviewCount: 1 }), "2026-08-11", "full")).toBe(
      "Graded · box 3 · due in 4 days · 1 review · added Aug 8",
    );
  });

  it("offers the trade on a promotable card and says why a prompt is greyed", () => {
    expect(buildReviewStatus(card({ type: "quote", box: null }), "2026-08-11", "full")).toBe(
      "Not in review · hide the body to recall this",
    );
    expect(buildReviewStatus(card({ type: "prompt", box: null }), "2026-08-11", "full")).toBe(
      "Not learnable · a prompt is answered, not recalled",
    );
  });

  it("names the card's age when it folds but is out of review", () => {
    expect(buildReviewStatus(card({ box: null }), "2026-08-11", "full")).toBe(
      "Not learning · added Aug 8",
    );
    expect(buildReviewStatus(card({ box: null }), "2026-08-11", "short")).toBe("Not learning");
  });
});
