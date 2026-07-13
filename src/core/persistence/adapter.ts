import type { CalendarEvent } from "@/features/calendar-sync/events-model";
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

/** A realtime push from the backend: the full current contents of one collection. */
export type CollectionSnapshot = {
  [C in CollectionName]: { col: C; items: Dataset[C] };
}[CollectionName];

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
  /**
   * Optional realtime subscription. Backends that support live sync (Firestore)
   * call `onChange` with a collection's full contents whenever it changes
   * remotely. Returns an unsubscribe function. Local-only adapters omit this.
   */
  subscribe?(onChange: (snap: CollectionSnapshot) => void): () => void;
}
