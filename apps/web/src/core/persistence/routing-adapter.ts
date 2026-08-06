import type { CollectionName, Dataset, PersistenceAdapter } from "./adapter";
import { DexieAdapter } from "./dexie-adapter";

/**
 * The exported `persistence` singleton. Delegates every call to a current
 * adapter — Dexie when signed out, Firestore when signed in. Swapping the
 * delegate (on auth change) requires no changes to store/feature code.
 */
export class RoutingAdapter implements PersistenceAdapter {
  private current: PersistenceAdapter = new DexieAdapter();

  /** Replace the active backend (e.g. on sign-in / sign-out). */
  setDelegate(adapter: PersistenceAdapter) {
    this.current = adapter;
  }

  init() {
    return this.current.init();
  }
  isEmpty() {
    return this.current.isEmpty();
  }
  loadAll() {
    return this.current.loadAll();
  }
  readSyncVersion() {
    return this.current.readSyncVersion();
  }
  load<C extends CollectionName>(col: C) {
    return this.current.load(col);
  }
  put<C extends CollectionName>(col: C, item: Dataset[C][number]) {
    return this.current.put(col, item);
  }
  bulkPut<C extends CollectionName>(col: C, items: Dataset[C]) {
    return this.current.bulkPut(col, items);
  }
  remove(col: CollectionName, id: string) {
    return this.current.remove(col, id);
  }
  bulkRemove<C extends CollectionName>(col: C, ids: string[]) {
    return this.current.bulkRemove(col, ids);
  }
  clearAll() {
    return this.current.clearAll();
  }
}

export const persistence = new RoutingAdapter();
