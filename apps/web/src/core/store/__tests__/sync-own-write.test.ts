import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  version: 5,
  loadAllCalls: 0,
  listeners: [] as ((version: number) => void)[],
  tasks: [] as { id: string; title: string; updatedAt: string }[],
  pendingCollections: [] as string[],
  isLoadDown: false,
}));

vi.mock("@/core/firebase/app", () => ({ auth: { currentUser: null }, db: {} }));
vi.mock("@/core/firebase/profile", () => ({
  getCloudProfile: vi.fn(async () => null),
  setCloudProfile: vi.fn(async () => {}),
}));
vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    DexieAdapter: class {
      clearAll = vi.fn(async () => {});
      isEmpty = vi.fn(async () => true);
    },
  };
});
vi.mock("@/core/persistence/trpc-adapter", async () => {
  const { createEmptyDataset } = await import("@/core/persistence");
  return {
    TrpcAdapter: class {
      constructor(_client: unknown, onSyncVersion: (version: number) => void) {
        server.listeners.push(onSyncVersion);
      }
      readSyncVersion = vi.fn(async () => server.version);
      loadAll = vi.fn(async () => {
        server.loadAllCalls += 1;
        if (server.isLoadDown) throw new Error("backend down");
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
  pendingWriteCollections: () => new Set(server.pendingCollections),
}));

import { useStore } from "../store";

const latestListener = () => server.listeners[server.listeners.length - 1];

/** A signed-in tab must not pay for re-reading the account after its own writes. */
describe("own writes and the sync cursor", () => {
  beforeEach(async () => {
    server.version = 5;
    server.pendingCollections = [];
    server.isLoadDown = false;
    server.tasks = [
      { id: "t1", title: "one", updatedAt: "2026-10-01T00:00:00.000Z" },
      { id: "t2", title: "two", updatedAt: "2026-10-01T00:00:00.000Z" },
    ];
    useStore.setState({ authUid: null, authResolved: true, refreshGcalStatus: async () => {} });
    await useStore.getState().onAuthChange("account-a");
    server.loadAllCalls = 0;
  });

  it("does not refetch for a version its own write produced", async () => {
    server.version = 6;
    latestListener()(6);
    await useStore.getState().refetchIfChanged();
    expect(server.loadAllCalls).toBe(0);
  });

  it("refetches again when a refetch had to skip a collection with a write in flight", async () => {
    server.pendingCollections = ["tasks"];
    server.tasks = [{ ...server.tasks[0], title: "edited elsewhere" }, server.tasks[1]];
    server.version = 6;
    await useStore.getState().refetchIfChanged();
    expect(useStore.getState().tasks[0].title).toBe("one");

    server.pendingCollections = [];
    latestListener()(7);
    server.version = 7;
    await useStore.getState().refetchIfChanged();

    expect(server.loadAllCalls).toBe(2);
    expect(useStore.getState().tasks[0].title).toBe("edited elsewhere");
  });

  it("refetches again after a refetch that failed to load", async () => {
    server.isLoadDown = true;
    server.version = 6;
    await useStore.getState().refetchIfChanged();

    server.isLoadDown = false;
    await useStore.getState().refetchIfChanged();
    expect(server.loadAllCalls).toBe(2);
  });

  it("refetches once when another device wrote between its own writes", async () => {
    server.version = 7;
    latestListener()(7);
    await useStore.getState().refetchIfChanged();
    await useStore.getState().refetchIfChanged();
    expect(server.loadAllCalls).toBe(1);
  });

  it("ignores a write receipt from the previous account's adapter", async () => {
    const previousListener = latestListener();
    useStore.setState({ authUid: "account-a" });
    await useStore.getState().onAuthChange("account-b");
    server.loadAllCalls = 0;

    previousListener(6);
    server.version = 6;
    await useStore.getState().refetchIfChanged();
    expect(server.loadAllCalls).toBe(1);
  });

  it("keeps unchanged rows by reference across a refetch", async () => {
    const before = useStore.getState().tasks;
    server.tasks = [server.tasks[0], { ...server.tasks[1], title: "two (edited)" }];
    server.version = 9;
    await useStore.getState().refetchIfChanged();

    const after = useStore.getState().tasks;
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].title).toBe("two (edited)");
  });

  it("keeps the collection by reference when nothing in it changed", async () => {
    const before = useStore.getState().tasks;
    server.version = 9;
    await useStore.getState().refetchIfChanged();
    expect(server.loadAllCalls).toBe(1);
    expect(useStore.getState().tasks).toBe(before);
  });
});
