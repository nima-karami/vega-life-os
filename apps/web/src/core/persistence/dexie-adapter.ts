import type { Table } from "dexie";
import {
  COLLECTIONS,
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
    const entries = await Promise.all(
      COLLECTIONS.map(async (col) => [col, await tableFor(col).toArray()] as const),
    );
    return { ...createEmptyDataset(), ...Object.fromEntries(entries) } as Dataset;
  }

  async load<C extends CollectionName>(col: C): Promise<Dataset[C]> {
    return (await tableFor(col).toArray()) as Dataset[C];
  }

  /** The sandbox is the only writer of its own database, so it can never be behind. */
  async readSyncVersion(): Promise<number> {
    return 0;
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
    await Promise.all(COLLECTIONS.map((col) => db[col].clear()));
  }
}
