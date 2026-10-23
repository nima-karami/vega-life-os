import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCloudProfile } = vi.hoisted(() => ({ getCloudProfile: vi.fn() }));

vi.mock("@/core/firebase/app", () => ({ auth: { currentUser: null }, firebaseEnabled: true }));
vi.mock("@/core/firebase/profile", () => ({
  getCloudProfile,
  setCloudProfile: vi.fn(async () => {}),
}));
vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    persistence: { ...actual.persistence, setDelegate: vi.fn() },
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
      loadSnapshot = vi.fn(async () => ({ syncVersion: 1, dataset: createEmptyDataset() }));
    },
  };
});
vi.mock("@/core/persistence/migrations", () => ({
  hasMigrationSources: () => false,
  runDataMigrations: vi.fn(async () => {}),
}));
vi.mock("./persist", () => ({
  setPersistAuth: vi.fn(),
  bindPersistStore: vi.fn(),
  pendingWriteCollections: () => new Set(),
}));

import { useStore } from "./store";

describe("account load hydrates the nudge watermark and quiet mode", () => {
  beforeEach(() => {
    getCloudProfile.mockReset();
    getCloudProfile.mockResolvedValue({ gratitudeNudgeAckedThrough: "2026-06-20" });
    useStore.setState({
      authUid: "account-a",
      authResolved: true,
      gratitudeNudgeAckedThrough: "2026-09-01",
      refreshGcalStatus: async () => {},
    });
  });

  it("has the new account's watermark before the app renders, from one profile read", async () => {
    let watermarkWhenReady: string | null | undefined;
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.ready && !prev.ready) watermarkWhenReady = state.gratitudeNudgeAckedThrough;
    });
    await useStore.getState().onAuthChange("account-b");
    unsubscribe();

    expect(watermarkWhenReady).toBe("2026-06-20");
    expect(getCloudProfile).toHaveBeenCalledTimes(2);
  });

  it("drops the previous account's watermark when local state is cleared", async () => {
    await useStore.getState().clearLocal();
    expect(useStore.getState().gratitudeNudgeAckedThrough).toBeNull();
  });

  it("has the account's quiet mode before the app renders, defaulting to on", async () => {
    getCloudProfile.mockResolvedValue({ quietMode: false });
    let quietWhenReady: boolean | undefined;
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.ready && !prev.ready) quietWhenReady = state.quietMode;
    });
    await useStore.getState().onAuthChange("account-b");
    unsubscribe();
    expect(quietWhenReady).toBe(false);

    await useStore.getState().clearLocal();
    expect(useStore.getState().quietMode).toBe(true);
  });
});
