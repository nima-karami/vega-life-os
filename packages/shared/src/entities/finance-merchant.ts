import { z } from "zod";
import { defineEntity, nullableString } from "./base";

const { schema, createSchema } = defineEntity({
  id: z.string(),
  pattern: z.string(),
  displayName: z.string(),
  defaultCategoryId: nullableString,
  defaultSpreadMonths: z.number().default(1),
  timesSeen: z.number().default(0),
  // a review-only hint: the same merchant legitimately varies, so a share never writes back
  timesShared: z.number().default(0),
  lastSeenAt: nullableString,
});

export const financeMerchantSchema = schema;
export const financeMerchantCreateSchema = createSchema;
export type FinanceMerchant = z.infer<typeof financeMerchantSchema>;
export type FinanceMerchantCreate = z.infer<typeof financeMerchantCreateSchema>;
