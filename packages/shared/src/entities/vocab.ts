import { z } from "zod";
import { defineEntity, nullableString } from "./base";

const { schema, createSchema } = defineEntity({
  id: z.string(),
  term: z.string(),
  definition: z.string(),
  example: z.string(),
  language: z.string(),
  box: z.number(),
  lastReviewed: nullableString,
  nextDue: nullableString,
  addedAt: z.string(),
});

export const vocabEntrySchema = schema;
export const vocabEntryCreateSchema = createSchema;
export type VocabEntry = z.infer<typeof vocabEntrySchema>;
export type VocabEntryCreate = z.infer<typeof vocabEntryCreateSchema>;
