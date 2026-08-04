import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyDataset, type PersistenceAdapter, persistence } from "@/core/persistence";
import { useStore } from "@/core/store";

let version = 1;
let loadAllCalls = 0;
let versionReads = 0;
let counterIsDown = false;

const countingAdapter: PersistenceAdapter = {
  init: async () => {},
  isEmpty: async () => false,
  loadAll: async () => {
    loadAllCalls += 1;
    return createEmptyDataset();
  },
  readSyncVersion: async () => {
    versionReads += 1;
    if (counterIsDown) throw new Error("counter unreachable");
    return version;
  },
  load: async () => [] as never,
  put: async () => {},
  bulkPut: async () => {},
  remove: async () => {},
  clearAll: async () => {},
};

/** An idle signed-in tab must cost one document read, not a full re-read of the account. */
describe("sync cursor — refetchIfChanged", () => {
  beforeEach(async () => {
    persistence.setDelegate(countingAdapter);
    useStore.setState({ authUid: "u-sync" });
    counterIsDown = false;
    // Settle the cursor onto the current version so each test starts from "up to date".
    await useStore.getState().refetchIfChanged();
    loadAllCalls = 0;
    versionReads = 0;
  });

  it("reads only the counter while nothing has changed", async () => {
    await useStore.getState().refetchIfChanged();
    await useStore.getState().refetchIfChanged();
    await useStore.getState().refetchIfChanged();

    expect(loadAllCalls).toBe(0);
    expect(versionReads).toBe(3);
  });

  it("pulls the dataset once when the counter advances", async () => {
    version += 1;
    await useStore.getState().refetchIfChanged();
    expect(loadAllCalls).toBe(1);

    await useStore.getState().refetchIfChanged();
    expect(loadAllCalls).toBe(1);
  });

  it("stays idle while signed out", async () => {
    useStore.setState({ authUid: null });
    await useStore.getState().refetchIfChanged();

    expect(versionReads).toBe(0);
    expect(loadAllCalls).toBe(0);
  });

  it("does not treat an unreachable counter as unchanged", async () => {
    counterIsDown = true;
    version += 1;
    await useStore.getState().refetchIfChanged();
    expect(loadAllCalls).toBe(0);

    counterIsDown = false;
    await useStore.getState().refetchIfChanged();
    expect(loadAllCalls).toBe(1);
  });
});
