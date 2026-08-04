import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const financeSettlementStatusSchema = z.enum(["open", "settled", "amended"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  month: z.string(),
  status: financeSettlementStatusSchema,
  // frozen once settled: a later change amends the month, it never rewrites this figure
  settledBalanceCents: z.number().nullable(),
  settledAt: nullableString,
  paidCents: z.number().nullable(),
  paidAt: nullableString,
  paymentTransactionId: nullableString,
  // carries both an amendment delta and a payment shortfall into the next open month
  carriedDeltaCents: z.number().default(0),
  note: z.string(),
});

export const financeSettlementSchema = schema;
export const financeSettlementCreateSchema = createSchema;
export type FinanceSettlement = z.infer<typeof financeSettlementSchema>;
export type FinanceSettlementCreate = z.infer<typeof financeSettlementCreateSchema>;
export type FinanceSettlementStatus = z.infer<typeof financeSettlementStatusSchema>;
