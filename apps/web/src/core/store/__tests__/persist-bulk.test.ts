import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BulkPutResult,
  type BulkRemoveResult,
  PartialWriteError,
  type PersistenceAdapter,
  persistence,
} from "@/core/persistence";
import { useStore } from "@/core/store";
import {
  pendingWriteCollections,
  saveBulkPut,
  saveBulkRemove,
  setPersistAuth,
} from "@/core/store/persist";

const { setSandboxDirty } = vi.hoisted(() => ({ setSandboxDirty: vi.fn() }));
vi.mock("@/core/persistence/sandbox-meta", () => ({
  setSandboxDirty,
  getSandboxDirty: vi.fn(async () => false),
  isSandboxDirty: () => false,
}));

type Card = { id: string; title: string };

type Deferred<T> = {
  promise: Promise<T>;
  settleWith: (value: T) => void;
  rejectWith: (error: unknown) => void;
};

function defer<T>(): Deferred<T> {
  let settleWith!: (value: T) => void;
  let rejectWith!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settleWith = resolve;
    rejectWith = reject;
  });
  return { promise, settleWith, rejectWith };
}

let pendingPut: Deferred<BulkPutResult>;
let pendingRemove: Deferred<BulkRemoveResult>;
/** What a reconciling refetch would pull; null makes the refetch fail, leaving the store alone. */
let serverRows: Card[] | null = null;
const putCalls = vi.fn();
const removeCalls = vi.fn();

const unreachable = () => Promise.reject(new Error("backend down"));

const controlledAdapter: PersistenceAdapter = {
  init: async () => {},
  isEmpty: async () => false,
  loadAll: () => unreachable() as Promise<never>,
  readSyncVersion: () => unreachable() as Promise<never>,
  load: () =>
    serverRows ? Promise.resolve(serverRows as never) : (unreachable() as Promise<never>),
  put: unreachable,
  bulkPut: () => {
    putCalls();
    return pendingPut.promise;
  },
  remove: unreachable,
  bulkRemove: () => {
    removeCalls();
    return pendingRemove.promise;
  },
  clearAll: unreachable,
};

const card = (id: string, title: string): Card => ({ id, title });
const cardIds = () => [...useStore.getState().mindCards.map((row) => row.id)].sort();
const titleOf = (id: string) => useStore.getState().mindCards.find((row) => row.id === id)?.title;
const setCards = (cards: Card[]) => useStore.setState({ mindCards: cards as never });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function resetBulkHarness() {
  persistence.setDelegate(controlledAdapter);
  pendingPut = defer<BulkPutResult>();
  pendingRemove = defer<BulkRemoveResult>();
  serverRows = null;
  putCalls.mockClear();
  removeCalls.mockClear();
  setSandboxDirty.mockClear();
  setPersistAuth("u-bulk");
  useStore.setState({ toast: null, authUid: "u-bulk" });
  setCards([card("c1", "Original")]);
}

describe("bulk writes participate in write tracking", () => {
  beforeEach(resetBulkHarness);

  it("reports the collection as pending while a bulk put is in flight and clears it after", async () => {
    const saved = saveBulkPut("mindCards", [card("c1", "Edited")] as never);

    expect(pendingWriteCollections().has("mindCards")).toBe(true);

    pendingPut.settleWith({ inserted: 1, skipped: 0, writtenChunks: 1 });
    await saved;
    expect(pendingWriteCollections().has("mindCards")).toBe(false);
  });

  it("reports the collection as pending while a bulk remove is in flight and clears it after", async () => {
    const saved = saveBulkRemove("mindCards", ["c1"]);

    expect(pendingWriteCollections().has("mindCards")).toBe(true);

    pendingRemove.settleWith({ removed: 1, missing: 0, writtenChunks: 1 });
    await saved;
    expect(pendingWriteCollections().has("mindCards")).toBe(false);
  });

  it("a refetch mid-bulk-write cannot overwrite the collection with server rows", async () => {
    serverRows = [card("c1", "Stale")];
    const saved = saveBulkPut("mindCards", [card("c1", "Edited")] as never);
    setCards([card("c1", "Edited")]);

    await useStore.getState().refetchCollection("mindCards");
    expect(titleOf("c1")).toBe("Edited");

    pendingPut.settleWith({ inserted: 1, skipped: 0, writtenChunks: 1 });
    await saved;

    // Once the write has settled the same refetch is free to reconcile.
    await useStore.getState().refetchCollection("mindCards");
    expect(titleOf("c1")).toBe("Stale");
  });

  it("returns the adapter's counts when everything lands", async () => {
    const saved = saveBulkRemove("mindCards", ["c1", "ghost"]);
    pendingRemove.settleWith({ removed: 1, missing: 1, writtenChunks: 1 });

    expect(await saved).toEqual({
      landedRows: 2,
      writtenChunks: 1,
      result: { removed: 1, missing: 1, writtenChunks: 1 },
    });
  });
});

describe("bulk writes revert their optimistic update on rejection", () => {
  beforeEach(resetBulkHarness);

  const editThenInsert = () => {
    setCards([card("c1", "Edited"), card("c2", "New")]);
    return saveBulkPut("mindCards", [card("c1", "Edited"), card("c2", "New")] as never, [
      { kind: "update", prior: card("c1", "Original") as never },
      { kind: "insert" },
    ]);
  };

  it("restores prior rows and drops inserted ones when the whole put is rejected", async () => {
    const saved = editThenInsert();
    pendingPut.rejectWith(new Error("backend down"));
    await saved;

    expect(cardIds()).toEqual(["c1"]);
    expect(titleOf("c1")).toBe("Original");
  });

  it("keeps the landed prefix and reverts only the rest on a partial put", async () => {
    const saved = editThenInsert();
    pendingPut.rejectWith(
      new PartialWriteError({ writtenRows: 1, writtenChunks: 1, failedChunk: 1 }),
    );

    expect(await saved).toMatchObject({ landedRows: 1, writtenChunks: 1, result: null });
    expect(cardIds()).toEqual(["c1"]);
    expect(titleOf("c1")).toBe("Edited");
  });

  it("puts every removed row back when the whole delete is rejected", async () => {
    const prior = [card("c1", "Original"), card("c2", "Second")];
    setCards([]);
    const saved = saveBulkRemove("mindCards", ["c1", "c2"], prior as never);
    pendingRemove.rejectWith(new Error("backend down"));
    await saved;

    expect(cardIds()).toEqual(["c1", "c2"]);
    expect(titleOf("c2")).toBe("Second");
  });

  it("keeps the landed deletions and restores only the rest on a partial delete", async () => {
    const prior = [card("c1", "Original"), card("c2", "Second")];
    setCards([]);
    const saved = saveBulkRemove("mindCards", ["c1", "c2"], prior as never);
    pendingRemove.rejectWith(
      new PartialWriteError({ writtenRows: 1, writtenChunks: 1, failedChunk: 1 }),
    );
    await saved;

    expect(cardIds()).toEqual(["c2"]);
  });

  it("keeps the optimistic rows when the caller offers no rollback", async () => {
    setCards([card("c1", "Edited")]);
    const saved = saveBulkPut("mindCards", [card("c1", "Edited")] as never);
    pendingPut.rejectWith(new Error("backend down"));
    await saved;

    expect(titleOf("c1")).toBe("Edited");
  });

  it("raises a retry toast whose action re-runs the whole bulk operation", async () => {
    const saved = saveBulkRemove("mindCards", ["c1"], [card("c1", "Original")] as never);
    pendingRemove.rejectWith(new Error("backend down"));
    await saved;

    const toast = useStore.getState().toast;
    expect(toast?.sticky).toBe(true);
    expect(toast?.action?.label).toBe("Retry");

    pendingRemove = defer<BulkRemoveResult>();
    toast?.action?.onClick();
    await flush();

    expect(removeCalls).toHaveBeenCalledTimes(2);
    pendingRemove.settleWith({ removed: 1, missing: 0, writtenChunks: 1 });
  });
});

describe("bulk writes flag the signed-out sandbox dirty", () => {
  beforeEach(resetBulkHarness);

  it("marks the sandbox dirty on a signed-out bulk write, not on a signed-in one", async () => {
    setPersistAuth(null);
    const removed = saveBulkRemove("mindCards", ["c1"]);
    pendingRemove.settleWith({ removed: 1, missing: 0, writtenChunks: 1 });
    await removed;
    expect(setSandboxDirty).toHaveBeenCalledWith(true);

    setSandboxDirty.mockClear();
    setPersistAuth("u-bulk");
    const put = saveBulkPut("mindCards", [card("c1", "Edited")] as never);
    pendingPut.settleWith({ inserted: 1, skipped: 0, writtenChunks: 1 });
    await put;
    expect(setSandboxDirty).not.toHaveBeenCalled();
  });
});
