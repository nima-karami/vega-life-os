import { describe, expect, it, vi } from "vitest";
import {
  expirePendingUndo,
  type PendingUndo,
  replacePendingUndo,
  runPendingUndo,
  UNDO_WINDOW_MS,
} from "../undo-queue";

const pending = (id: number, restore: () => void): PendingUndo => ({
  id,
  message: `${id} cards deleted`,
  restore,
});

describe("undo queue", () => {
  it("holds the bar for eight seconds", () => {
    expect(UNDO_WINDOW_MS).toBe(8000);
  });

  it("replaces the bar on a second action and commits the first", () => {
    const firstRestore = vi.fn();
    const secondRestore = vi.fn();
    const next = replacePendingUndo(pending(1, firstRestore), pending(2, secondRestore));
    expect(next.id).toBe(2);
    expect(firstRestore).not.toHaveBeenCalled();
    expect(secondRestore).not.toHaveBeenCalled();
  });

  it("expires only the entry its timer was armed for", () => {
    const current = pending(2, vi.fn());
    expect(expirePendingUndo(current, 1)).toBe(current);
    expect(expirePendingUndo(current, 2)).toBeNull();
  });

  it("restores once and clears the bar", () => {
    const restore = vi.fn();
    expect(runPendingUndo(pending(1, restore))).toBeNull();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("is a no-op with no bar showing", () => {
    expect(runPendingUndo(null)).toBeNull();
    expect(expirePendingUndo(null, 1)).toBeNull();
  });
});
