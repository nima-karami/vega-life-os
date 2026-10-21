import { z } from "zod";
import { defineEntity, nullableString } from "./base";

const { schema, createSchema } = defineEntity({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  hue: z.string(),
  spectrum: z.string(),
  energy: z.number(),
  desc: z.string(),
  order: z.number(),
  archivedAt: nullableString,
  restingAt: nullableString.default(null),
});

export const valueSchema = schema;
export const valueCreateSchema = createSchema;
export type Value = z.infer<typeof valueSchema>;
export type ValueCreate = z.infer<typeof valueCreateSchema>;
