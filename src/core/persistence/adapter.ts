import type { Value } from "@/features/values/model";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Book, Movie, VocabEntry } from "@/features/library/model";
import type { Review } from "@/features/review/model";

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
}

export type CollectionName = keyof Dataset;
export type Entity = Dataset[CollectionName][number];

export const COLLECTIONS: CollectionName[] = [
  "values",
  "goals",
  "habits",
  "tasks",
  "books",
  "movies",
  "vocab",
  "reviews",
];

export function emptyDataset(): Dataset {
  return {
    values: [],
    goals: [],
    habits: [],
    tasks: [],
    books: [],
    movies: [],
    vocab: [],
    reviews: [],
  };
}

/**
 * The persistence seam. DexieAdapter (IndexedDB) implements this today; a
 * Firebase/Supabase adapter can drop in later with the same surface, enabling
 * cross-device sync without touching feature code.
 */
export interface PersistenceAdapter {
  init(): Promise<void>;
  isEmpty(): Promise<boolean>;
  loadAll(): Promise<Dataset>;
  put<C extends CollectionName>(col: C, item: Dataset[C][number]): Promise<void>;
  bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  clearAll(): Promise<void>;
}
