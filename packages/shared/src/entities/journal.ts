import { z } from "zod";
import { defineEntity } from "./base";

const { schema, createSchema } = defineEntity({
  id: z.string(),
  date: z.string(),
  gratitude: z.array(z.string()),
  mood: z.number().nullable(),
  journal: z.string(),
  createdAt: z.string(),
});

export const dayEntrySchema = schema;
export const dayEntryCreateSchema = createSchema;
export type DayEntry = z.infer<typeof dayEntrySchema>;
export type DayEntryCreate = z.infer<typeof dayEntryCreateSchema>;
