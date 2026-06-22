import { describe, expect, it } from "vitest";
import {
  type DayEntry,
  entryStatus,
  GRATITUDE_ITEM_MAX,
  hasContent,
  hasGratitude,
  isReflected,
  JOURNAL_MAX,
  mergeDayEntry,
} from "./model";

const base = (over: Partial<DayEntry> = {}): DayEntry => ({
  id: "day_x",
  date: "2026-06-22",
  gratitude: [],
  mood: null,
  journal: "",
  createdAt: "t0",
  updatedAt: "t0",
  ...over,
});

describe("predicates", () => {
  it("hasGratitude is true only with a non-blank slot", () => {
    expect(hasGratitude(base())).toBe(false);
    expect(hasGratitude(base({ gratitude: ["  "] }))).toBe(false);
    expect(hasGratitude(base({ gratitude: ["sun"] }))).toBe(true);
    expect(hasGratitude(undefined)).toBe(false);
  });

  it("isReflected needs mood OR journal (gratitude alone does not count)", () => {
    expect(isReflected(base({ gratitude: ["sun"] }))).toBe(false);
    expect(isReflected(base({ mood: 3 }))).toBe(true);
    expect(isReflected(base({ journal: "ok" }))).toBe(true);
  });

  it("entryStatus maps content to none/started/reflected", () => {
    expect(entryStatus(undefined)).toBe("none");
    expect(entryStatus(base())).toBe("none");
    expect(entryStatus(base({ gratitude: ["sun"] }))).toBe("started");
    expect(entryStatus(base({ mood: 4 }))).toBe("reflected");
  });

  it("hasContent is true for any of gratitude/mood/journal", () => {
    expect(hasContent(base())).toBe(false);
    expect(hasContent(base({ gratitude: ["x"] }))).toBe(true);
  });
});

describe("mergeDayEntry", () => {
  it("creates a new entry from a patch (stamps timestamps + id)", () => {
    const out = mergeDayEntry(undefined, "2026-06-22", { gratitude: ["sun"] }, "t1");
    expect(out).not.toBeNull();
    expect(out?.date).toBe("2026-06-22");
    expect(out?.gratitude).toEqual(["sun"]);
    expect(out?.createdAt).toBe("t1");
    expect(out?.updatedAt).toBe("t1");
    expect(out?.id).toMatch(/^day_/);
  });

  it("updates an existing entry, preserving id/createdAt and bumping updatedAt", () => {
    const existing = base({ id: "day_1", gratitude: ["a"], createdAt: "t0" });
    const out = mergeDayEntry(existing, "2026-06-22", { mood: 5 }, "t2");
    expect(out?.id).toBe("day_1");
    expect(out?.createdAt).toBe("t0");
    expect(out?.updatedAt).toBe("t2");
    expect(out?.mood).toBe(5);
    expect(out?.gratitude).toEqual(["a"]);
  });

  it("drops blank gratitude slots and clamps lengths", () => {
    const out = mergeDayEntry(
      undefined,
      "2026-06-22",
      {
        gratitude: ["keep", "   ", "x".repeat(GRATITUDE_ITEM_MAX + 50)],
        journal: "y".repeat(JOURNAL_MAX + 100),
      },
      "t1",
    );
    expect(out?.gratitude).toEqual(["keep", "x".repeat(GRATITUDE_ITEM_MAX)]);
    expect(out?.journal.length).toBe(JOURNAL_MAX);
  });

  it("returns null (discard) when the merged entry has no content", () => {
    expect(mergeDayEntry(undefined, "2026-06-22", { gratitude: ["  "] }, "t1")).toBeNull();
    expect(mergeDayEntry(base({ id: "day_1" }), "2026-06-22", { journal: "" }, "t1")).toBeNull();
  });
});
