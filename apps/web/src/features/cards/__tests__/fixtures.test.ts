import { cardCreateSchema, cardSchema } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildCard, buildCardCreate } from "./fixtures";

describe("buildCard", () => {
  it("builds a note that parses against the stored schema", () => {
    const parsed = cardSchema.safeParse(buildCard());
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("applies overrides", () => {
    expect(buildCard({ id: "c_2", category: "focus" })).toMatchObject({
      id: "c_2",
      category: "focus",
    });
  });

  it("builds a valid card of any type when given that type's slots", () => {
    const vocabulary = buildCard({
      type: "vocabulary",
      title: "sonder",
      body: "A realisation.",
      phonetic: "/ˈsɒn.dər/",
      language: "English",
      examples: ["A quiet sonder."],
      synonyms: ["ache"],
    });
    expect(cardSchema.safeParse(vocabulary).success).toBe(true);
  });
});

describe("buildCardCreate", () => {
  it("parses against the create schema and carries no server-owned meta", () => {
    const input = buildCardCreate();
    expect(cardCreateSchema.safeParse({ ...input, id: "c_1" }).success).toBe(true);
    expect(Object.keys(input)).not.toContain("updatedAt");
    expect(Object.keys(input)).not.toContain("fieldUpdatedAt");
    expect(Object.keys(input)).not.toContain("id");
  });
});
