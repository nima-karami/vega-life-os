import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const financePayerSchema = z.enum(["me", "partner"]);
export const financeTransactionSourceSchema = z.enum(["import", "manual"]);
export const financeEnteredBySchema = z.enum(["me", "partner-reported"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  dedupeKey: nullableString,
  accountId: nullableString,
  // the single period key: cash basis, so budgets, cash flow and settlement all read this
  txnDate: z.string(),
  spreadMonths: z.number().int().min(1).max(36).default(1),
  // the user-facing label; `description` stays the raw bank string, untouched
  title: z.string().default(""),
  description: z.string(),
  amountCents: z.number(),
  currency: z.string().default("CAD"),
  originalAmountCents: z.number().nullable(),
  originalCurrency: nullableString,
  categoryId: nullableString,
  merchantId: nullableString,
  payer: financePayerSchema,
  isHousehold: z.boolean().default(false),
  // out of range here silently poisons every derived share and the settlement balance
  myShareBps: z.number().int().min(0).max(10000).default(10000),
  isInternal: z.boolean().default(false),
  source: financeTransactionSourceSchema,
  enteredBy: financeEnteredBySchema,
  importBatchId: nullableString,
  sourceRowNumber: z.number().nullable(),
  refundOfTransactionId: nullableString,
  reviewFlags: z.array(z.string()).default([]),
  resolvedFlags: z.array(z.string()).default([]),
  note: z.string(),
  createdAt: z.string(),
});

export const financeTransactionSchema = schema;
export const financeTransactionCreateSchema = createSchema;
export type FinanceTransaction = z.infer<typeof financeTransactionSchema>;
export type FinanceTransactionCreate = z.infer<typeof financeTransactionCreateSchema>;
export type FinancePayer = z.infer<typeof financePayerSchema>;
export type FinanceTransactionSource = z.infer<typeof financeTransactionSourceSchema>;
export type FinanceEnteredBy = z.infer<typeof financeEnteredBySchema>;
