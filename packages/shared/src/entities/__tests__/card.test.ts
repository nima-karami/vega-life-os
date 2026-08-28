import { describe, expect, it } from "vitest";
import { buildCardSchema, cardCreateSchema, cardSchema } from "../card";
import { CARD_TYPES } from "../card-types";
import { describeEntityContract } from "./entity-contract";

const valid = {
  id: "c_1",
  type: "note",
  category: "mental models",
  title: "Inversion",
  body: "Solve the problem backward.",
  author: null,
  work: null,
  locator: null,
  phonetic: null,
  language: null,
  examples: [],
  synonyms: [],
  hasRecall: false,
  addedAt: "2026-07-01",
  hiddenAt: null,
  likedAt: null,
  box: 2,
  lastReviewed: "2026-07-04",
  nextDue: "2026-07-06",
  reviewCount: 7,
  updatedAt: "2026-07-13T10:00:00.000Z",
  fieldUpdatedAt: {},
};

describeEntityContract("card", { schema: cardSchema, createSchema: cardCreateSchema, valid });

const parse = (over: Record<string, unknown>) => cardSchema.safeParse({ ...valid, ...over });

describe("rule 1 — every required slot is non-empty after trim", () => {
  it("rejects a blank title", () => {
    expect(parse({ title: "   " }).success).toBe(false);
  });

  it("rejects a blank body", () => {
    expect(parse({ body: "" }).success).toBe(false);
  });

  it("rejects a vocabulary card with no definition", () => {
    expect(
      parse({
        type: "vocabulary",
        body: "",
        title: "sonder",
        box: null,
        lastReviewed: null,
        nextDue: null,
      }).success,
    ).toBe(false);
  });
});

describe("rule 2 — a slot the type does not declare is empty", () => {
  it("rejects synonyms on a quote", () => {
    expect(
      parse({ type: "quote", synonyms: ["a"], box: null, lastReviewed: null, nextDue: null })
        .success,
    ).toBe(false);
  });

  it("rejects a phonetic on a note", () => {
    expect(parse({ phonetic: "/ˈsɒn.dər/" }).success).toBe(false);
  });

  it("rejects an author on an excerpt, which declares work and locator instead", () => {
    const base = {
      type: "excerpt",
      hasRecall: false,
      box: null,
      lastReviewed: null,
      nextDue: null,
    };
    expect(parse({ ...base, author: "Didion" }).success).toBe(false);
    expect(parse({ ...base, work: "The White Album", locator: "p. 11" }).success).toBe(true);
  });

  it("accepts a quote carrying author and work", () => {
    expect(
      parse({
        type: "quote",
        author: "Seneca",
        work: "Letters",
        box: null,
        lastReviewed: null,
        nextDue: null,
      }).success,
    ).toBe(true);
  });
});

describe("rule 3 — every cap in the registry holds", () => {
  it("rejects a title past 160 and a body past 600", () => {
    expect(parse({ title: "x".repeat(161) }).success).toBe(false);
    expect(parse({ body: "x".repeat(601) }).success).toBe(false);
    expect(parse({ title: "x".repeat(160), body: "x".repeat(600) }).success).toBe(true);
  });

  it("rejects a sixth example and a thirteenth synonym", () => {
    const vocabulary = {
      type: "vocabulary",
      title: "sonder",
      body: "The realisation that every passer-by has a life as vivid as your own.",
      phonetic: "/ˈsɒn.dər/",
      language: "English",
    };
    expect(parse({ ...vocabulary, examples: Array(5).fill("an example") }).success).toBe(true);
    expect(parse({ ...vocabulary, examples: Array(6).fill("an example") }).success).toBe(false);
    expect(parse({ ...vocabulary, synonyms: Array(12).fill("word") }).success).toBe(true);
    expect(parse({ ...vocabulary, synonyms: Array(13).fill("word") }).success).toBe(false);
  });

  it("rejects an over-long item inside an array slot", () => {
    expect(
      parse({
        type: "vocabulary",
        title: "sonder",
        body: "A definition.",
        examples: ["x".repeat(201)],
      }).success,
    ).toBe(false);
  });

  it("rejects a category past 60", () => {
    expect(parse({ category: "x".repeat(61) }).success).toBe(false);
  });
});

describe("rule 4 — a card that cannot be learned carries no schedule", () => {
  it("rejects a box on a card with no reveal", () => {
    expect(parse({ type: "quote", box: 1, lastReviewed: null, nextDue: null }).success).toBe(false);
  });

  it("rejects a next due or last reviewed date without a box", () => {
    expect(
      parse({ type: "quote", box: null, nextDue: "2026-07-06", lastReviewed: null }).success,
    ).toBe(false);
    expect(
      parse({ type: "quote", box: null, nextDue: null, lastReviewed: "2026-07-04" }).success,
    ).toBe(false);
  });

  it("keeps the lifetime review count on a card that is not learning", () => {
    const parsed = parse({
      type: "quote",
      box: null,
      lastReviewed: null,
      nextDue: null,
      reviewCount: 7,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.reviewCount).toBe(7);
  });
});

describe("rule 5 — hasRecall implies a title and a learnable type", () => {
  it("rejects recall on a prompt", () => {
    expect(
      parse({ type: "prompt", hasRecall: true, box: null, lastReviewed: null, nextDue: null })
        .success,
    ).toBe(false);
  });

  it("accepts recall on a quote and lets it carry a schedule", () => {
    expect(parse({ type: "quote", hasRecall: true }).success).toBe(true);
  });
});

describe("buildCardSchema is registry-driven", () => {
  it("validates a type the shipped registry has never heard of", () => {
    const registry = {
      ...CARD_TYPES,
      recipe: {
        label: "Recipe",
        signature: "title-body" as const,
        slots: {
          title: { label: "Dish", required: true as const, max: 160, example: "Tarte Tatin" },
          body: {
            label: "Method",
            required: true as const,
            lines: "tall" as const,
            max: 600,
            example: "Caramelise the apples, lay the pastry over, bake, then invert.",
          },
        },
      },
    };
    const { schema } = buildCardSchema(
      ["note", "quote", "excerpt", "fact", "prompt", "vocabulary", "recipe"] as const,
      registry,
    );
    const recipe = { ...valid, type: "recipe", box: null, lastReviewed: null, nextDue: null };
    expect(schema.safeParse(recipe).success).toBe(true);
    expect(schema.safeParse({ ...recipe, phonetic: "/x/" }).success).toBe(false);
    expect(cardSchema.safeParse(recipe).success).toBe(false);
  });
});
