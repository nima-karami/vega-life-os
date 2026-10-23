import { describe, expect, it, vi } from "vitest";
import { createSliceHarness } from "@/core/store/__tests__/slice-harness";
import { savePut } from "@/core/store/persist";
import type { DayEntry } from "./model";
import { createJournalSlice } from "./store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));

/** Minimal harness: drive the slice with a local state object. */
function makeSlice() {
  return createSliceHarness(createJournalSlice);
}

describe("journal slice", () => {
  it("creates an entry on first non-empty upsert", () => {
    const { get } = makeSlice();
    const out = get().upsertDayEntry("2026-06-22", { gratitude: ["sun"] });
    expect(out).not.toBeNull();
    expect(get().journal).toHaveLength(1);
    expect(get().getDayEntry("2026-06-22")?.gratitude).toEqual(["sun"]);
  });

  it("updates the same record (one per date) on subsequent upserts", () => {
    const { get } = makeSlice();
    get().upsertDayEntry("2026-06-22", { gratitude: ["sun"] });
    const id1 = get().getDayEntry("2026-06-22")?.id;
    get().upsertDayEntry("2026-06-22", { mood: 4 });
    expect(get().journal).toHaveLength(1);
    expect(get().getDayEntry("2026-06-22")?.id).toBe(id1);
    expect(get().getDayEntry("2026-06-22")?.mood).toBe(4);
  });

  it("does not create a record for an all-empty upsert", () => {
    const { get } = makeSlice();
    const out = get().upsertDayEntry("2026-06-22", { journal: "   " });
    expect(out).toBeNull();
    expect(get().journal).toHaveLength(0);
  });

  it("removes an existing record when it is emptied", () => {
    const { get } = makeSlice();
    get().upsertDayEntry("2026-06-22", { journal: "hi" });
    get().upsertDayEntry("2026-06-22", { journal: "" });
    expect(get().journal).toHaveLength(0);
  });

  it("removeDayEntry deletes by id; restoreDayEntry re-adds intact", () => {
    const { get } = makeSlice();
    get().upsertDayEntry("2026-06-22", { mood: 3 });
    const entry = get().getDayEntry("2026-06-22") as DayEntry;
    get().removeDayEntry(entry.id);
    expect(get().journal).toHaveLength(0);
    get().restoreDayEntry(entry);
    expect(get().getDayEntry("2026-06-22")?.id).toBe(entry.id);
  });

  it("debounces persistence: coalesces rapid edits into one save after the idle window", () => {
    vi.useFakeTimers();
    vi.mocked(savePut).mockClear();
    const { get } = makeSlice();

    get().upsertDayEntry("2026-07-01", { gratitude: ["a"] });
    get().upsertDayEntry("2026-07-01", { gratitude: ["a", "b"] });
    get().upsertDayEntry("2026-07-01", { gratitude: ["a", "b", "c"] });

    // In-memory state is current immediately; nothing persisted yet.
    expect(get().getDayEntry("2026-07-01")?.gratitude).toEqual(["a", "b", "c"]);
    expect(savePut).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(savePut).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePut).mock.calls[0]?.[1]).toMatchObject({ gratitude: ["a", "b", "c"] });

    vi.useRealTimers();
  });

  it("persists immediately with { immediate: true } (the gratitude card)", () => {
    vi.useFakeTimers();
    vi.mocked(savePut).mockClear();
    const { get } = makeSlice();

    get().upsertDayEntry("2026-07-02", { gratitude: ["x"] }, { immediate: true });
    // No debounce wait — the save lands synchronously so a fast reload keeps it.
    expect(savePut).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe("gratitude nudge acknowledgement", () => {
  it("never moves the watermark backwards", () => {
    const { get } = makeSlice();
    get().acknowledgeGratitudeNudge("2026-06-24");
    get().acknowledgeGratitudeNudge("2026-06-20");
    expect(get().gratitudeNudgeAckedThrough).toBe("2026-06-24");
  });
});
