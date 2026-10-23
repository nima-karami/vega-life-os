import { beforeEach, describe, expect, it, vi } from "vitest";

const { put, loadAll } = vi.hoisted(() => ({
  put: vi.fn(),
  loadAll: vi.fn(),
}));

vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    persistence: { ...actual.persistence, put, loadAll, setDelegate: vi.fn() },
  };
});

import { createEmptyDataset } from "@/core/persistence";
import { savePut } from "./persist";
import { useStore } from "./store";

describe("refetchAll pending-write guard", () => {
  beforeEach(() => {
    put.mockReset();
    loadAll.mockReset();
    useStore.setState({ authUid: "u1", tasks: [] });
  });

  it("keeps the optimistic value for a collection whose write hasn't settled", async () => {
    let settlePut = () => {};
    put.mockReturnValue(new Promise<void>((resolve) => (settlePut = resolve)));
    useStore.setState({ tasks: [{ id: "t1", title: "local" } as never] });
    savePut("tasks", { id: "t1", title: "local" } as never);

    loadAll.mockResolvedValue({ ...createEmptyDataset(), tasks: [{ id: "t1", title: "stale" }] });
    await useStore.getState().refetchAll();

    expect(useStore.getState().tasks).toEqual([{ id: "t1", title: "local" }]);
    settlePut();
  });

  it("applies server truth for a collection with no pending write", async () => {
    loadAll.mockResolvedValue({ ...createEmptyDataset(), tasks: [{ id: "t2", title: "server" }] });
    await useStore.getState().refetchAll();
    expect(useStore.getState().tasks).toEqual([{ id: "t2", title: "server", fieldUpdatedAt: {} }]);
  });
});
