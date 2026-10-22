import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const VALUE_IDENTITY_MAX = 120;

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
  identity: z.string().max(VALUE_IDENTITY_MAX).default(""),
});

export const valueSchema = schema;
export const valueCreateSchema = createSchema;
export type Value = z.infer<typeof valueSchema>;
export type ValueCreate = z.infer<typeof valueCreateSchema>;
