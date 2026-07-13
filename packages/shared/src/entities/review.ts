import { z } from "zod";
import { defineEntity } from "./base";

export const reviewPromptSchema = z.object({ q: z.string(), a: z.string() }).strict();

const { schema, createSchema } = defineEntity({
  id: z.string(),
  periodKey: z.string(),
  prompts: z.array(reviewPromptSchema),
  completion: z.number(),
  createdAt: z.string(),
});

export const reviewSchema = schema;
export const reviewCreateSchema = createSchema;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export type ReviewPrompt = z.infer<typeof reviewPromptSchema>;
