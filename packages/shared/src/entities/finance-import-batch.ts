import { z } from "zod";
import { defineEntity, nullableString } from "./base";

// the row is only written at commit time; the earlier phases live in memory, never here
export const financeImportBatchStatusSchema = z.enum(["parsing", "committed", "partial-commit"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  status: financeImportBatchStatusSchema,
  fileNames: z.array(z.string()).default([]),
  fileHashes: z.array(z.string()).default([]),
  accountId: z.string(),
  detectedFormat: nullableString,
  rowsParsed: z.number().default(0),
  rowsInserted: z.number().default(0),
  rowsSkipped: z.number().default(0),
  startedAt: z.string(),
  committedAt: nullableString,
  // what a partial commit landed, so a retry resumes instead of re-writing
  writtenChunks: z.number().default(0),
});

export const financeImportBatchSchema = schema;
export const financeImportBatchCreateSchema = createSchema;
export type FinanceImportBatch = z.infer<typeof financeImportBatchSchema>;
export type FinanceImportBatchCreate = z.infer<typeof financeImportBatchCreateSchema>;
export type FinanceImportBatchStatus = z.infer<typeof financeImportBatchStatusSchema>;
