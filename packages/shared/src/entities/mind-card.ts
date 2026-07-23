import { z } from "zod";
import { defineEntity, nullableString } from "./base";

const { schema, createSchema } = defineEntity({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: z.string(),
  source: nullableString,
  addedAt: z.string(),
  hiddenAt: nullableString,
  box: z.number().nullable(),
  lastReviewed: nullableString,
  nextDue: nullableString,
});

export const mindCardSchema = schema;
export const mindCardCreateSchema = createSchema;
export type MindCard = z.infer<typeof mindCardSchema>;
export type MindCardCreate = z.infer<typeof mindCardCreateSchema>;
