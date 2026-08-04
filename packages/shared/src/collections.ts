import { z } from "zod";
import { bookCreateSchema, bookSchema } from "./entities/book";
import { calendarEventCreateSchema, calendarEventSchema } from "./entities/calendar-event";
import { financeAccountCreateSchema, financeAccountSchema } from "./entities/finance-account";
import { financeBudgetCreateSchema, financeBudgetSchema } from "./entities/finance-budget";
import { financeCategoryCreateSchema, financeCategorySchema } from "./entities/finance-category";
import {
  financeImportBatchCreateSchema,
  financeImportBatchSchema,
} from "./entities/finance-import-batch";
import { financeMerchantCreateSchema, financeMerchantSchema } from "./entities/finance-merchant";
import {
  financeSettlementCreateSchema,
  financeSettlementSchema,
} from "./entities/finance-settlement";
import {
  financeTransactionCreateSchema,
  financeTransactionSchema,
} from "./entities/finance-transaction";
import { goalCreateSchema, goalSchema } from "./entities/goal";
import { habitCreateSchema, habitSchema } from "./entities/habit";
import { dayEntryCreateSchema, dayEntrySchema } from "./entities/journal";
import { mindCardCreateSchema, mindCardSchema } from "./entities/mind-card";
import { mindMetaCreateSchema, mindMetaSchema } from "./entities/mind-meta";
import { movieCreateSchema, movieSchema } from "./entities/movie";
import { reviewCreateSchema, reviewSchema } from "./entities/review";
import { taskCreateSchema, taskSchema } from "./entities/task";
import { valueCreateSchema, valueSchema } from "./entities/value";
import { vocabEntryCreateSchema, vocabEntrySchema } from "./entities/vocab";

/** Stored schema per collection — the registry the repository layer keys on. */
export const schemasByCollection = {
  values: valueSchema,
  goals: goalSchema,
  habits: habitSchema,
  tasks: taskSchema,
  books: bookSchema,
  movies: movieSchema,
  vocab: vocabEntrySchema,
  reviews: reviewSchema,
  journal: dayEntrySchema,
  calendarEvents: calendarEventSchema,
  mindCards: mindCardSchema,
  mindMeta: mindMetaSchema,
  financeAccounts: financeAccountSchema,
  financeCategories: financeCategorySchema,
  financeBudgets: financeBudgetSchema,
  financeMerchants: financeMerchantSchema,
  financeImportBatches: financeImportBatchSchema,
  financeTransactions: financeTransactionSchema,
  financeSettlements: financeSettlementSchema,
} as const;

/** Client-settable input schema per collection — server-owned meta + unknown keys stripped, not rejected. */
export const createSchemasByCollection = {
  values: valueCreateSchema,
  goals: goalCreateSchema,
  habits: habitCreateSchema,
  tasks: taskCreateSchema,
  books: bookCreateSchema,
  movies: movieCreateSchema,
  vocab: vocabEntryCreateSchema,
  reviews: reviewCreateSchema,
  journal: dayEntryCreateSchema,
  calendarEvents: calendarEventCreateSchema,
  mindCards: mindCardCreateSchema,
  mindMeta: mindMetaCreateSchema,
  financeAccounts: financeAccountCreateSchema,
  financeCategories: financeCategoryCreateSchema,
  financeBudgets: financeBudgetCreateSchema,
  financeMerchants: financeMerchantCreateSchema,
  financeImportBatches: financeImportBatchCreateSchema,
  financeTransactions: financeTransactionCreateSchema,
  financeSettlements: financeSettlementCreateSchema,
} as const;

export const COLLECTIONS = [
  "values",
  "goals",
  "habits",
  "tasks",
  "books",
  "movies",
  "vocab",
  "reviews",
  "journal",
  "calendarEvents",
  "mindCards",
  "mindMeta",
  "financeAccounts",
  "financeCategories",
  "financeBudgets",
  "financeMerchants",
  "financeImportBatches",
  "financeTransactions",
  "financeSettlements",
] as const;

export const collectionNameSchema = z.enum(COLLECTIONS);
export type CollectionName = (typeof COLLECTIONS)[number];

export type Dataset = {
  [C in CollectionName]: z.infer<(typeof schemasByCollection)[C]>[];
};
