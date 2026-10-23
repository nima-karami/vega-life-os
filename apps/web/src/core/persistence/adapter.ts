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
  WireRow,
} from "@vega/shared";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { DayEntry } from "@/features/journal/model";
import type { Book, Movie, VocabEntry } from "@/features/library/model";
import type { Review } from "@/features/review/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";

/** The complete local dataset, loaded into memory on boot. */
export interface Dataset {
  values: Value[];
  goals: Goal[];
  habits: Habit[];
  tasks: Task[];
  books: Book[];
  movies: Movie[];
  vocab: VocabEntry[];
  reviews: Review[];
  journal: DayEntry[];
  calendarEvents: CalendarEvent[];
  mindCards: MindCard[];
  mindMeta: MindMetaRecord[];
  financeAccounts: FinanceAccount[];
  financeCategories: FinanceCategory[];
  financeBudgets: FinanceBudget[];
  financeMerchants: FinanceMerchant[];
  financeImportBatches: FinanceImportBatch[];
  financeTransactions: FinanceTransaction[];
  financeSettlements: FinanceSettlement[];
  cards: Card[];
  cardPrefs: CardPrefs[];
}

export type CollectionName = keyof Dataset;
export type Entity = Dataset[CollectionName][number];

/** A row as an adapter loads it: the backend leaves the field-LWW stamps out, Dexie keeps them. */
export type LoadedRow<T> = WireRow<T> & { fieldUpdatedAt?: Record<string, string> };
export type LoadedDataset = { [C in CollectionName]: LoadedRow<Dataset[C][number]>[] };

export const COLLECTIONS: CollectionName[] = [
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
  "cards",
  "cardPrefs",
];

export function createEmptyDataset(): Dataset {
  return {
    values: [],
    goals: [],
    habits: [],
    tasks: [],
    books: [],
    movies: [],
    vocab: [],
    reviews: [],
    journal: [],
    calendarEvents: [],
    mindCards: [],
    mindMeta: [],
    financeAccounts: [],
    financeCategories: [],
    financeBudgets: [],
    financeMerchants: [],
    financeImportBatches: [],
    financeTransactions: [],
    financeSettlements: [],
    cards: [],
    cardPrefs: [],
  };
}

/**
 * What a bulk write landed. The backend chunks the payload itself and reports its own
 * counts, so no caller has to know the chunk size; Dexie writes the array as one chunk.
 */
export interface BulkPutResult {
  inserted: number;
  skipped: number;
  writtenChunks: number;
}

/** What a bulk delete landed. `missing` ids were already gone — they cost no write and no counter bump. */
export interface BulkRemoveResult {
  removed: number;
  missing: number;
  writtenChunks: number;
}

/**
 * The persistence seam. `DexieAdapter` (IndexedDB) backs the signed-out sandbox;
 * `TrpcAdapter` (the backend) backs signed-in users. The `RoutingAdapter` swaps
 * between them on auth change without feature code noticing.
 */
export interface PersistenceAdapter {
  init(): Promise<void>;
  isEmpty(): Promise<boolean>;
  loadAll(): Promise<LoadedDataset>;
  /** Monotonic per-user write counter — one read that says whether `loadAll` is worth paying for. */
  readSyncVersion(): Promise<number>;
  load<C extends CollectionName>(col: C): Promise<LoadedDataset[C]>;
  put<C extends CollectionName>(col: C, item: Dataset[C][number]): Promise<void>;
  bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<BulkPutResult>;
  remove(col: CollectionName, id: string): Promise<void>;
  bulkRemove<C extends CollectionName>(col: C, ids: string[]): Promise<BulkRemoveResult>;
  clearAll(): Promise<void>;
}
