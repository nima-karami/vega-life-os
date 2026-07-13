import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const movieStatusSchema = z.enum(["queued", "watched"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  director: z.string(),
  status: movieStatusSchema,
  rating: z.number().nullable(),
  watchedAt: nullableString,
  note: z.string(),
  order: z.number(),
});

export const movieSchema = schema;
export const movieCreateSchema = createSchema;
export type Movie = z.infer<typeof movieSchema>;
export type MovieCreate = z.infer<typeof movieCreateSchema>;
export type MovieStatus = z.infer<typeof movieStatusSchema>;
