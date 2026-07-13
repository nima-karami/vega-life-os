import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const bookStatusSchema = z.enum(["queued", "reading", "finished", "abandoned"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  status: bookStatusSchema,
  rating: z.number().nullable(),
  pages: z.number().nullable(),
  currentPage: z.number().nullable(),
  startedAt: nullableString,
  finishedAt: nullableString,
  valueId: nullableString,
  note: z.string(),
  order: z.number(),
});

export const bookSchema = schema;
export const bookCreateSchema = createSchema;
export type Book = z.infer<typeof bookSchema>;
export type BookCreate = z.infer<typeof bookCreateSchema>;
export type BookStatus = z.infer<typeof bookStatusSchema>;
