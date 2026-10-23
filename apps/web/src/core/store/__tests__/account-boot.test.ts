import { beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; isSettled: () => boolean };

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let isSettled = false;
  const promise = new Promise<T>((done) => {
    resolve = (value) => {
      isSettled = true;
      done(value);
    };
  });
  return { promise, resolve, isSettled: () => isSettled };
}

type TaskRow = { id: string; title: string; updatedAt: string };
type Snapshot = { syncVersion: number; tasks: TaskRow[] };

const server = vi.hoisted(() => ({
  version: 0,
  tasks: [] as TaskRow[],
  pending: {
    clear: null as Deferred<void> | null,
    snapshot: null as Deferred<Snapshot> | null,
    profile: null as Deferred<null> | null,
  },
  calls: { clear: 0, snapshot: 0, profile: 0, syncVersion: 0, loadAll: 0 },
}));

vi.mock("@/core/firebase/app", () => ({ auth: { currentUser: null }, db: {} }));
vi.mock("@/core/firebase/profile", () => ({
  getCloudProfile: vi.fn(() => {
    server.calls.profile += 1;
    return server.pending.profile?.promise ?? Promise.resolve(null);
  }),
  setCloudProfile: vi.fn(async () => {}),
}));
vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    DexieAdapter: class {
      clearAll = vi.fn(() => {
        server.calls.clear += 1;
        return server.pending.clear?.promise ?? Promise.resolve();
      });
      isEmpty = vi.fn(async () => true);
    },
  };
});
vi.mock("@/core/persistence/trpc-adapter", async () => {
  const { createEmptyDataset } = await import("@/core/persistence");
  return {
    TrpcAdapter: class {
      readSyncVersion = vi.fn(async () => {
        server.calls.syncVersion += 1;
        return server.version;
      });
      loadSnapshot = vi.fn(async () => {
        server.calls.snapshot += 1;
        const snapshot = server.pending.snapshot
          ? await server.pending.snapshot.promise
          : { syncVersion: server.version, tasks: server.tasks };
        return {
          syncVersion: snapshot.syncVersion,
          dataset: { ...createEmptyDataset(), tasks: snapshot.tasks.map((task) => ({ ...task })) },
        };
      });
      loadAll = vi.fn(async () => {
        server.calls.loadAll += 1;
        return { ...createEmptyDataset(), tasks: server.tasks.map((task) => ({ ...task })) };
      });
    },
  };
});
vi.mock("@/core/persistence/migrations", () => ({
  hasMigrationSources: () => false,
  runDataMigrations: vi.fn(async () => {}),
}));
vi.mock("../persist", () => ({
  setPersistAuth: vi.fn(),
  bindPersistStore: vi.fn(),
  pendingWriteCollections: () => new Set(),
}));

import { useStore } from "../store";

const task = (id: string): TaskRow => ({ id, title: id, updatedAt: "2026-10-01T00:00:00.000Z" });
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));
const taskIds = () => useStore.getState().tasks.map((row) => row.id);

describe("signed-in boot", () => {
  beforeEach(() => {
    server.version = 5;
    server.tasks = [task("t1")];
    server.pending = { clear: null, snapshot: null, profile: null };
    server.calls = { clear: 0, snapshot: 0, profile: 0, syncVersion: 0, loadAll: 0 };
    useStore.setState({ authUid: null, authResolved: true, refreshGcalStatus: async () => {} });
  });

  it("has the local clear, the snapshot and the profile read in flight before any resolves", async () => {
    const clear = createDeferred<void>();
    const snapshot = createDeferred<Snapshot>();
    const profile = createDeferred<null>();
    server.pending = { clear, snapshot, profile };

    const boot = useStore.getState().onAuthChange("account-a");
    await flushMicrotasks();

    expect(server.calls).toMatchObject({ clear: 1, snapshot: 1, profile: 1 });
    expect([clear, snapshot, profile].some((request) => request.isSettled())).toBe(false);
    expect(useStore.getState().ready).toBe(false);

    profile.resolve(null);
    snapshot.resolve({ syncVersion: 5, tasks: [task("t1")] });
    await flushMicrotasks();
    expect(useStore.getState().ready).toBe(false);

    clear.resolve();
    await boot;
    expect(useStore.getState().ready).toBe(true);
    expect(taskIds()).toEqual(["t1"]);
    expect(server.calls.syncVersion).toBe(0);
  });

  it("refetches on the next poll when a write lands while the snapshot is loading", async () => {
    const snapshot = createDeferred<Snapshot>();
    server.pending.snapshot = snapshot;

    const boot = useStore.getState().onAuthChange("account-a");
    await flushMicrotasks();
    server.version = 6;
    server.tasks = [task("t1"), task("t2")];
    snapshot.resolve({ syncVersion: 5, tasks: [task("t1")] });
    await boot;
    expect(taskIds()).toEqual(["t1"]);

    await useStore.getState().refetchIfChanged();

    expect(server.calls.loadAll).toBe(1);
    expect(taskIds()).toEqual(["t1", "t2"]);
  });
});
