import { z } from "zod";
import { defineEntity } from "./base";

/**
 * Sparse per-month rows keyed `{categoryId}:{month}`. The effective budget for a
 * month is the latest row at or before it, so editing July never moves March.
 */
const { schema, createSchema } = defineEntity({
  id: z.string(),
  categoryId: z.string(),
  month: z.string(),
  cents: z.number(),
});

export const financeBudgetSchema = schema;
export const financeBudgetCreateSchema = createSchema;
export type FinanceBudget = z.infer<typeof financeBudgetSchema>;
export type FinanceBudgetCreate = z.infer<typeof financeBudgetCreateSchema>;
