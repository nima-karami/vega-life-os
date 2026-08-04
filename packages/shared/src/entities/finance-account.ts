import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const financeAccountKindSchema = z.enum(["chequing", "savings", "credit_card"]);

/** Statement layout learned once per account; `dateFormat` and `debitsArePositive` are never inferred. */
export const financeColumnMappingSchema = z.object({
  dateColumn: z.string(),
  descriptionColumn: z.string(),
  amountColumn: nullableString,
  debitColumn: nullableString,
  creditColumn: nullableString,
  dateFormat: z.string(),
  debitsArePositive: z.boolean(),
});

const { schema, createSchema } = defineEntity({
  id: z.string(),
  // the dedupe key is built from this, so it must stay stable across a card reissue
  slug: z.string(),
  displayName: z.string(),
  kind: financeAccountKindSchema,
  isBusiness: z.boolean().default(false),
  columnMapping: financeColumnMappingSchema.nullable(),
  archivedAt: nullableString,
});

export const financeAccountSchema = schema;
export const financeAccountCreateSchema = createSchema;
export type FinanceAccount = z.infer<typeof financeAccountSchema>;
export type FinanceAccountCreate = z.infer<typeof financeAccountCreateSchema>;
export type FinanceAccountKind = z.infer<typeof financeAccountKindSchema>;
export type FinanceColumnMapping = z.infer<typeof financeColumnMappingSchema>;
