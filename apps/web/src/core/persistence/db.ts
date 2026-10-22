import type {
  CalendarEvent,
  Card,
  CardPrefs,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
  MindCard,
  MindMetaRecord,
} from "@vega/shared";
import Dexie, { type Table } from "dexie";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { DayEntry } from "@/features/journal/model";
import type { Book, Movie, VocabEntry } from "@/features/library/model";
import type { Review } from "@/features/review/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";

class VegaDB extends Dexie {
  values!: Table<Value, string>;
  goals!: Table<Goal, string>;
  habits!: Table<Habit, string>;
  tasks!: Table<Task, string>;
  books!: Table<Book, string>;
  movies!: Table<Movie, string>;
  vocab!: Table<VocabEntry, string>;
  reviews!: Table<Review, string>;
  journal!: Table<DayEntry, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  mindCards!: Table<MindCard, string>;
  mindMeta!: Table<MindMetaRecord, string>;
  cards!: Table<Card, string>;
  cardPrefs!: Table<CardPrefs, string>;
  financeAccounts!: Table<FinanceAccount, string>;
  financeCategories!: Table<FinanceCategory, string>;
  financeBudgets!: Table<FinanceBudget, string>;
  financeMerchants!: Table<FinanceMerchant, string>;
  financeImportBatches!: Table<FinanceImportBatch, string>;
  financeTransactions!: Table<FinanceTransaction, string>;
  financeSettlements!: Table<FinanceSettlement, string>;
  meta!: Table<{ key: string; dirty?: boolean }, string>;

  constructor() {
    super("vega-life-os");
    const stores = {
      // only index fields we actually query on; Dexie stores the whole object
      values: "id, order",
      goals: "id, valueId, order",
      habits: "id, valueId, goalId",
      tasks: "id, date, status, kind, habitId, goalId, valueId, order",
      books: "id, status, order",
      movies: "id, status, order",
      vocab: "id, box, nextDue",
    };
    this.version(1).stores(stores);
    this.version(2).stores({ ...stores, reviews: "id, periodKey" });
    this.version(3).stores({ ...stores, reviews: "id, periodKey", journal: "id, date" });
    this.version(4).stores({
      ...stores,
      reviews: "id, periodKey",
      journal: "id, date",
      meta: "key",
    });
    this.version(5).stores({
      ...stores,
      reviews: "id, periodKey",
      journal: "id, date",
      meta: "key",
      calendarEvents: "id, calendarId, iCalUID, valueId, date",
    });
    const storesV6 = {
      ...stores,
      reviews: "id, periodKey",
      journal: "id, date",
      meta: "key",
      calendarEvents: "id, calendarId, iCalUID, valueId, date",
      mindCards: "id, category, box, nextDue, addedAt",
      mindMeta: "id, kind",
    };
    this.version(6).stores(storesV6);
    const storesV7 = {
      ...storesV6,
      financeAccounts: "id, slug",
      financeCategories: "id, order",
      financeBudgets: "id, categoryId, month",
      financeMerchants: "id, pattern",
      financeImportBatches: "id, status, startedAt",
      financeTransactions:
        "id, txnDate, accountId, categoryId, merchantId, dedupeKey, importBatchId",
      financeSettlements: "id",
    };
    this.version(7).stores(storesV7);
    this.version(8).stores({
      ...storesV7,
      cards: "id, type, category, box, nextDue, addedAt",
      cardPrefs: "id",
    });
  }
}

export const db = new VegaDB();
