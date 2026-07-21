import type { CalendarEvent } from "@vega/shared";
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
  "journal",
  "calendarEvents",
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
  };
}

/**
 * The persistence seam. `DexieAdapter` (IndexedDB) backs the signed-out sandbox;
 * `TrpcAdapter` (the backend) backs signed-in users. The `RoutingAdapter` swaps
 * between them on auth change without feature code noticing.
 */
export interface PersistenceAdapter {
  init(): Promise<void>;
  isEmpty(): Promise<boolean>;
  loadAll(): Promise<Dataset>;
  load<C extends CollectionName>(col: C): Promise<Dataset[C]>;
  put<C extends CollectionName>(col: C, item: Dataset[C][number]): Promise<void>;
  bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  clearAll(): Promise<void>;
}
