import { z } from "zod";
import { defineEntity, nullableString } from "./base";

const MIND_CARD_TYPES = [
  "model",
  "fact",
  "excerpt",
  "quote",
  "principle",
  "affirmation",
  "reminder",
  "aspiration",
  "prompt",
] as const;

const { schema, createSchema } = defineEntity({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  type: z.enum(MIND_CARD_TYPES).default("model"),
  category: z.string(),
  source: nullableString,
  addedAt: z.string(),
  hiddenAt: nullableString,
  likedAt: nullableString.default(null),
  flippable: z.boolean().default(true),
  box: z.number().nullable(),
  lastReviewed: nullableString,
  nextDue: nullableString,
});

export const mindCardSchema = schema;
export const mindCardCreateSchema = createSchema;
export type MindCard = z.infer<typeof mindCardSchema>;
export type MindCardCreate = z.infer<typeof mindCardCreateSchema>;
export type MindCardType = MindCard["type"];
