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

import { useStore } from "./store";

describe("scope-aware data actions", () => {
  beforeEach(() => {
    clearAll.mockClear();
    dexieClear.mockClear();
    useStore.setState({
      authUid: null,
      values: [{ id: "v1" } as never],
      tasks: [{ id: "t1" } as never],
    });
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
});
