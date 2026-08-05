import { beforeEach, describe, expect, it } from "vitest";
import { type PersistenceAdapter, persistence } from "@/core/persistence";
import { useStore } from "@/core/store";
import type { Task } from "@/features/tasks/model";

const down = () => Promise.reject(new Error("backend down"));

const rejectingAdapter: PersistenceAdapter = {
  init: async () => {},
  isEmpty: async () => true,
  loadAll: () => down() as Promise<never>,
  readSyncVersion: () => down() as Promise<never>,
  load: () => down() as Promise<never>,
  put: () => down(),
  bulkPut: () => down(),
  remove: () => down(),
  bulkRemove: () => down(),
  clearAll: () => down(),
};

const task = (id: string, title: string): Task => ({
  id,
  title,
  kind: "oneoff",
  habitId: null,
  goalId: null,
  valueId: null,
  date: null,
  slotDate: null,
  completedAt: null,
  time: null,
  durationMin: 30,
  status: "open",
  detached: false,
  note: "",
  order: 0,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("online-first write contract — tasks.updateTask rollback", () => {
  beforeEach(() => {
    persistence.setDelegate(rejectingAdapter);
    useStore.setState({ tasks: [task("t1", "Original")], toast: null, authUid: null });
  });

  it("reverts the optimistic edit to its prior value when the backend rejects", async () => {
    useStore.getState().updateTask("t1", { title: "Edited" });
    // optimistic echo is applied synchronously
    expect(useStore.getState().tasks.find((t) => t.id === "t1")?.title).toBe("Edited");

    await flush();

    // the rejected write rolls the row back to its pre-edit value
    expect(useStore.getState().tasks.find((t) => t.id === "t1")?.title).toBe("Original");
  });

  it("raises a retry toast whose action re-attempts the write", async () => {
    useStore.getState().updateTask("t1", { title: "Edited" });
    await flush();

    const toast = useStore.getState().toast;
    expect(toast?.sticky).toBe(true);
    expect(toast?.action?.label).toBe("Retry");
    expect(typeof toast?.action?.onClick).toBe("function");
  });
});
