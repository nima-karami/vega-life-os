import { type CollectionName, type Dataset, persistence } from "@/core/persistence";
import { setSandboxDirty } from "@/core/persistence/sandbox-meta";
import type { RootState } from "./types";

/**
 * The store is injected (not imported) to avoid a store→slice→persist import
 * cycle. store.ts calls `bindPersistStore(useStore)` once, after the store exists.
 */
type StoreRef = {
  getState: () => RootState;
  setState: (partial: (state: RootState) => Partial<RootState>) => void;
};
let store: StoreRef | null = null;
export function bindPersistStore(ref: StoreRef) {
  store = ref;
}

/** Current auth uid, mirrored here so signed-out writes can flag the sandbox dirty. */
let _authUid: string | null = null;
export function setPersistAuth(uid: string | null) {
  _authUid = uid;
}

/** Mark the local sandbox dirty on any signed-out user write (not seeding — seeds use bulkPut). */
function markDirtyIfSandbox() {
  if (_authUid === null) void setSandboxDirty(true);
}

type Row = { id: string };

/**
 * How to undo a rejected optimistic write: `insert` drops the row it added,
 * `update` restores the prior row it replaced. Call sites that don't opt in
 * (pass nothing) keep their optimistic value and reconcile on the background
 * refetch — never a destructive local drop. Signed-out Dexie writes don't reach
 * this path (they don't reject).
 */
export type WriteRollback<C extends CollectionName> =
  | { kind: "insert" }
  | { kind: "update"; prior: Dataset[C][number] };

function applyRollback<C extends CollectionName>(col: C, id: string, rollback?: WriteRollback<C>) {
  if (!rollback) return;
  store?.setState((state) => {
    const list = ((state as unknown as Record<string, Row[]>)[col] ?? []) as Row[];
    const next =
      rollback.kind === "insert"
        ? list.filter((row) => row.id !== id)
        : list.map((row) => (row.id === id ? (rollback.prior as Row) : row));
    return { [col]: next } as unknown as Partial<RootState>;
  });
}

function undoRemove<C extends CollectionName>(col: C, prior: Dataset[C][number] | undefined) {
  if (!prior) return;
  store?.setState((state) => {
    const list = ((state as unknown as Record<string, Row[]>)[col] ?? []) as Row[];
    return { [col]: [...list, prior as Row] } as unknown as Partial<RootState>;
  });
}

function raiseRetry(retry: () => void) {
  store?.getState().pushRetryToast("Couldn’t save your change — check your connection", retry);
}

/**
 * Persist an insert/update. On rejection: undo the optimistic change per
 * `rollback`, background-refetch to reconcile, and offer a Retry.
 */
export function savePut<C extends CollectionName>(
  col: C,
  item: Dataset[C][number],
  rollback?: WriteRollback<C>,
) {
  markDirtyIfSandbox();
  const id = (item as Row).id;
  void persistence.put(col, item).catch(() => {
    applyRollback(col, id, rollback);
    void store?.getState().refetchCollection(col);
    raiseRetry(() => savePut(col, item, rollback));
  });
}

/** Persist a delete. On rejection: re-add the removed row (if given), refetch, and offer a Retry. */
export function saveRemove<C extends CollectionName>(
  col: C,
  id: string,
  prior?: Dataset[C][number],
) {
  markDirtyIfSandbox();
  void persistence.remove(col, id).catch(() => {
    undoRemove(col, prior);
    void store?.getState().refetchCollection(col);
    raiseRetry(() => saveRemove(col, id, prior));
  });
}

export function saveBulk<C extends CollectionName>(col: C, items: Dataset[C]) {
  void persistence.bulkPut(col, items).catch((e) => console.error("bulk", col, e));
}
