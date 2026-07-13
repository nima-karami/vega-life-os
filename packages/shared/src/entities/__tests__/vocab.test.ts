import { vocabEntryCreateSchema, vocabEntrySchema } from "../vocab";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("vocab", {
  schema: vocabEntrySchema,
  createSchema: vocabEntryCreateSchema,
  valid: {
    id: "voc_1",
    term: "sonder",
    definition: "the realization that each passerby has a vivid life",
    example: "a moment of sonder on the train",
    language: "en",
    box: 2,
    lastReviewed: "2026-07-10",
    nextDue: "2026-07-14",
    addedAt: "2026-07-01",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { term: "2026-07-13T10:00:00.000Z" },
  },
});
