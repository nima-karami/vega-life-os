import { z } from "zod";
import { defineEntity } from "./base";

export const reviewPromptSchema = z.object({ q: z.string(), a: z.string() }).strict();

const reviewCheckInSchema = z
  .object({ valueId: z.string(), rating: z.number().int().min(1).max(5) })
  .strict();

const { schema, createSchema } = defineEntity({
  id: z.string(),
  periodKey: z.string(),
  prompts: z.array(reviewPromptSchema),
  checkIns: z.array(reviewCheckInSchema).default([]),
  completion: z.number().optional(),
  createdAt: z.string(),
});

export const reviewSchema = schema;
export const reviewCreateSchema = createSchema;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export type ReviewPrompt = z.infer<typeof reviewPromptSchema>;
