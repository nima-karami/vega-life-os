import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const financeCategoryKindSchema = z.enum(["spend", "income"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  name: z.string(),
  kind: financeCategoryKindSchema,
  order: z.number(),
  colorIndex: z.number().int().min(0).max(5).nullable().default(null),
  archivedAt: nullableString,
});

export const financeCategorySchema = schema;
export const financeCategoryCreateSchema = createSchema;
export type FinanceCategory = z.infer<typeof financeCategorySchema>;
export type FinanceCategoryCreate = z.infer<typeof financeCategoryCreateSchema>;
export type FinanceCategoryKind = z.infer<typeof financeCategoryKindSchema>;
