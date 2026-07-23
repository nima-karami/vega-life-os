import { expect, it } from "vitest";
import { vocabEntryCreateSchema, vocabEntrySchema } from "../vocab";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("vocab", {
  schema: vocabEntrySchema,
  createSchema: vocabEntryCreateSchema,
  valid: {
    id: "voc_1",
    term: "sonder",
    definition: "the realization that each passerby has a vivid life",
    example: "",
    phonetic: "/ˈsɑndər/",
    examples: ["a moment of sonder on the train"],
    synonyms: ["shared humanity"],
    language: "en",
    box: 2,
    lastReviewed: "2026-07-10",
    nextDue: "2026-07-14",
    addedAt: "2026-07-01",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { term: "2026-07-13T10:00:00.000Z" },
  },
});

it("parses pre-vocabulary-feature records with empty phonetic/examples/synonyms", () => {
  const parsed = vocabEntrySchema.parse({
    id: "w_legacy",
    term: "petrichor",
    definition: "the smell after rain",
    example: "petrichor after the storm",
    language: "English",
    box: 2,
    lastReviewed: null,
    nextDue: "2026-07-24",
    addedAt: "2026-07-01",
    updatedAt: "",
    fieldUpdatedAt: {},
  });
  expect(parsed).toMatchObject({
    phonetic: "",
    examples: [],
    synonyms: [],
    example: "petrichor after the storm",
  });
});
