import type { Card } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  buildTypeChangeConfirmBody,
  buildTypeChangePatch,
  losesReviewOnTypeChange,
} from "../card-type-change";
import { buildCard } from "./fixtures";

const graded = (over: Partial<Card> = {}): Card =>
  buildCard({
    id: "w_1",
    type: "vocabulary",
    category: "Language",
    title: "saudade",
    body: "A deep, nostalgic longing for something absent.",
    phonetic: "/saʊˈdɑdə/",
    language: "Portuguese",
    examples: ["A quiet saudade for the city she left behind."],
    synonyms: ["longing", "nostalgia", "yearning"],
    box: 3,
    lastReviewed: "2026-08-07",
    nextDue: "2026-08-15",
    reviewCount: 7,
    ...over,
  });

describe("buildTypeChangePatch", () => {
  it("clears the slots the new type does not declare and keeps the title", () => {
    const patch = buildTypeChangePatch(graded(), "quote");
    expect(patch.type).toBe("quote");
    expect(patch.title).toBeUndefined();
    expect(patch.phonetic).toBeNull();
    expect(patch.language).toBeNull();
    expect(patch.examples).toEqual([]);
    expect(patch.synonyms).toEqual([]);
    expect(patch.locator).toBeNull();
    expect(patch.body).toBeUndefined();
  });

  it("never touches the lifetime review count, the category or the dates the card was born with", () => {
    const patch = buildTypeChangePatch(graded(), "prompt");
    expect(patch.reviewCount).toBeUndefined();
    expect(patch.category).toBeUndefined();
    expect(patch.addedAt).toBeUndefined();
    expect(patch.likedAt).toBeUndefined();
    expect(patch.hiddenAt).toBeUndefined();
  });

  it("ends the schedule when the new type can never be learned", () => {
    const patch = buildTypeChangePatch(graded(), "prompt");
    expect(patch.box).toBeNull();
    expect(patch.nextDue).toBeNull();
    expect(patch.lastReviewed).toBeNull();
    expect(patch.hasRecall).toBe(false);
  });

  it("ends the schedule when the new type has no reveal until it is promoted", () => {
    const patch = buildTypeChangePatch(graded(), "quote");
    expect(patch.box).toBeNull();
    expect(patch.nextDue).toBeNull();
    expect(patch.lastReviewed).toBeNull();
  });

  it("keeps the schedule when the new type still folds by default", () => {
    const patch = buildTypeChangePatch(graded(), "note");
    expect(patch.box).toBeUndefined();
    expect(patch.nextDue).toBeUndefined();
    expect(patch.lastReviewed).toBeUndefined();
  });

  it("drops a promotion the new type cannot carry", () => {
    const promoted = graded({ type: "quote", hasRecall: true, phonetic: null });
    expect(buildTypeChangePatch(promoted, "prompt").hasRecall).toBe(false);
    expect(buildTypeChangePatch(promoted, "note").hasRecall).toBe(false);
    expect(buildTypeChangePatch(promoted, "excerpt").hasRecall).toBe(false);
  });

  it("keeps the schedule when the card lands on a type that folds on its own", () => {
    const patch = buildTypeChangePatch(graded({ type: "quote", hasRecall: true }), "excerpt");
    expect(patch.hasRecall).toBe(false);
    expect(patch.box).toBeUndefined();
    expect(patch.nextDue).toBeUndefined();
    expect(patch.lastReviewed).toBeUndefined();
  });
});

describe("losesReviewOnTypeChange", () => {
  it("is true only when a card that is in review lands on a type that cannot hold it", () => {
    expect(losesReviewOnTypeChange(graded(), "prompt")).toBe(true);
    expect(losesReviewOnTypeChange(graded(), "quote")).toBe(true);
    expect(losesReviewOnTypeChange(graded(), "note")).toBe(false);
    expect(losesReviewOnTypeChange(graded(), "excerpt")).toBe(false);
    expect(losesReviewOnTypeChange(graded({ type: "excerpt" }), "quote")).toBe(true);
    expect(losesReviewOnTypeChange(graded({ box: null }), "prompt")).toBe(false);
  });
});

describe("buildTypeChangeConfirmBody", () => {
  it("names the type the card is moving to", () => {
    expect(buildTypeChangeConfirmBody("prompt")).toBe(
      "This card is in review. Changing to Prompt ends its schedule.",
    );
  });
});
