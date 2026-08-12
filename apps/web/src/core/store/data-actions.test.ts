// src/core/store/data-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearAll, dexieClear } = vi.hoisted(() => ({
  clearAll: vi.fn(async () => {}),
  dexieClear: vi.fn(async () => {}),
}));

vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    persistence: {
      ...actual.persistence,
      clearAll,
      bulkPut: vi.fn(async () => {}),
      setDelegate: vi.fn(),
    },
    DexieAdapter: class {
      clearAll = dexieClear;
    },
  };
});
vi.mock("@/core/persistence/sandbox-meta", () => ({ setSandboxDirty: vi.fn(async () => {}) }));

import { DEFAULT_CARD_PREFS } from "@vega/shared";
import { buildSeed, COLLECTIONS, createEmptyDataset } from "@/core/persistence";
import { useStore } from "./store";

describe("scope-aware data actions", () => {
  beforeEach(() => {
    clearAll.mockClear();
    dexieClear.mockClear();
    useStore.setState({
      ...createEmptyDataset(),
      authUid: null,
      values: [{ id: "v1" } as never],
      tasks: [{ id: "t1" } as never],
    } as never);
  });

  it("deleteAllData clears persistence and empties in-memory collections", async () => {
    await useStore.getState().deleteAllData();
    expect(clearAll).toHaveBeenCalledOnce();
    expect(useStore.getState().values).toEqual([]);
    expect(useStore.getState().tasks).toEqual([]);
  });

  it("resetDemo is a no-op while signed in (never touches the account)", async () => {
    useStore.setState({ authUid: "u1" });
    await useStore.getState().resetDemo();
    expect(dexieClear).not.toHaveBeenCalled();
    expect(clearAll).not.toHaveBeenCalled();
  });

  it("resetDemo re-seeds the sandbox when signed out", async () => {
    useStore.setState({ authUid: null });
    await useStore.getState().resetDemo();
    expect(dexieClear).toHaveBeenCalledOnce();
    expect(useStore.getState().values.length).toBeGreaterThan(0);
  });

  // resetDemo and exportJSON both hand-enumerate the dataset, so a new collection is
  // silently dropped from the sandbox reset and from every backup unless both are guarded.
  it("resetDemo lands every seeded collection in the store", async () => {
    await useStore.getState().resetDemo();
    const seed = buildSeed();
    const state = useStore.getState() as unknown as Record<string, unknown[]>;
    for (const col of COLLECTIONS.filter((name) => seed[name].length > 0)) {
      expect(state[col].length, col).toBeGreaterThan(0);
    }
  });

  it("exportJSON carries every registered collection", () => {
    // calendarEvents is the Google mirror and is absent from the export literal today.
    // cardPrefs is one record in state and one row on the wire, so it is asserted separately.
    const exported = new Set(
      COLLECTIONS.filter((col) => col !== "calendarEvents" && col !== "cardPrefs"),
    );
    useStore.setState(
      Object.fromEntries(COLLECTIONS.map((col) => [col, [{ id: `${col}-1` }]])) as never,
    );
    useStore.setState({ cardPrefs: { ...DEFAULT_CARD_PREFS } });
    const backup = JSON.parse(useStore.getState().exportJSON()) as {
      data: Record<string, { id: string }[]>;
    };
    for (const col of exported) expect(backup.data[col], col).toEqual([{ id: `${col}-1` }]);
    expect(backup.data.cardPrefs).toEqual([DEFAULT_CARD_PREFS]);
  });
});
