import type { Table } from "dexie";
import {
  type CollectionName,
  createEmptyDataset,
  type Dataset,
  type PersistenceAdapter,
} from "./adapter";
import { db } from "./db";

/** Narrow the per-name table off Dexie's wider union to the collection's own row type. */
const tableFor = <C extends CollectionName>(col: C) =>
  db[col] as unknown as Table<Dataset[C][number], string>;

/** IndexedDB-backed adapter (via Dexie). The default local-first persistence. */
export class DexieAdapter implements PersistenceAdapter {
  async init(): Promise<void> {
    if (!db.isOpen()) await db.open();
  }

  async isEmpty(): Promise<boolean> {
    const n = await db.values.count();
    return n === 0;
  }

  async loadAll(): Promise<Dataset> {
    const [values, goals, habits, tasks, books, movies, vocab, reviews, journal, calendarEvents] =
      await Promise.all([
        db.values.toArray(),
        db.goals.toArray(),
        db.habits.toArray(),
        db.tasks.toArray(),
        db.books.toArray(),
        db.movies.toArray(),
        db.vocab.toArray(),
        db.reviews.toArray(),
        db.journal.toArray(),
        db.calendarEvents.toArray(),
      ]);
    return {
      ...createEmptyDataset(),
      values,
      goals,
      habits,
      tasks,
      books,
      movies,
      vocab,
      reviews,
      journal,
      calendarEvents,
    };
  }

  async load<C extends CollectionName>(col: C): Promise<Dataset[C]> {
    return (await tableFor(col).toArray()) as Dataset[C];
  }

  async put<C extends CollectionName>(col: C, item: Dataset[C][number]): Promise<void> {
    await tableFor(col).put(item);
  }

  async bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<void> {
    await tableFor(col).bulkPut(items);
  }

  async remove(col: CollectionName, id: string): Promise<void> {
    await db[col].delete(id);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      db.values.clear(),
      db.goals.clear(),
      db.habits.clear(),
      db.tasks.clear(),
      db.books.clear(),
      db.movies.clear(),
      db.vocab.clear(),
      db.reviews.clear(),
      db.journal.clear(),
      db.calendarEvents.clear(),
    ]);
  }
}
