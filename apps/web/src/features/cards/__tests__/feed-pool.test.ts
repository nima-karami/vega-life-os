import type { CardPrefs } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildFeedPool, countFeedDue } from "../feed-pool";
import { buildCard } from "./fixtures";

const TODAY = "2026-08-11";

const prefs = (over: Partial<CardPrefs> = {}): CardPrefs => ({
  id: "feed",
  mode: "mix",
  types: [],
  categories: [],
  view: "rows",
  migratedAt: null,
  updatedAt: "2026-08-11T00:00:00.000Z",
  fieldUpdatedAt: {},
  ...over,
});

const plain = buildCard({ id: "plain", title: "Plain", category: "Mental models" });
const dueToday = buildCard({
  id: "due",
  title: "Due",
  category: "Language",
  box: 3,
  nextDue: TODAY,
  lastReviewed: "2026-08-03",
});
const notYetDue = buildCard({
  id: "later",
  title: "Later",
  category: "Language",
  box: 4,
  nextDue: "2026-08-30",
});
const hidden = buildCard({
  id: "hidden",
  title: "Hidden",
  category: "Mental models",
  hiddenAt: "2026-08-01T00:00:00.000Z",
});
const hiddenAndDue = buildCard({
  id: "hidden-due",
  title: "Hidden and due",
  category: "Language",
  box: 2,
  nextDue: "2026-08-01",
  hiddenAt: "2026-08-01T00:00:00.000Z",
});
const quote = buildCard({ id: "quote", type: "quote", title: "Quote", category: "Stoicism" });

const ALL = [plain, dueToday, notYetDue, hidden, hiddenAndDue, quote];
const idsIn = (cards: { id: string }[]): string[] => cards.map((card) => card.id).sort();

describe("buildFeedPool — mode semantics", () => {
  it("admits only due learning cards in due mode", () => {
    expect(idsIn(buildFeedPool(ALL, prefs({ mode: "due" }), TODAY))).toEqual(["due"]);
  });

  it("admits everything in mix mode", () => {
    expect(idsIn(buildFeedPool(ALL, prefs({ mode: "mix" }), TODAY))).toEqual([
      "due",
      "later",
      "plain",
      "quote",
    ]);
  });

  it("admits nothing graded in read mode", () => {
    expect(idsIn(buildFeedPool(ALL, prefs({ mode: "read" }), TODAY))).toEqual(["plain", "quote"]);
  });

  it("treats a card due yesterday as due", () => {
    const overdue = buildCard({ id: "overdue", title: "Overdue", box: 1, nextDue: "2026-08-01" });
    expect(idsIn(buildFeedPool([overdue], prefs({ mode: "due" }), TODAY))).toEqual(["overdue"]);
  });

  it("drops hidden cards in every mode", () => {
    for (const mode of ["due", "mix", "read"] as const) {
      const ids = idsIn(buildFeedPool(ALL, prefs({ mode }), TODAY));
      expect(ids).not.toContain("hidden");
      expect(ids).not.toContain("hidden-due");
    }
  });
});

describe("buildFeedPool — the chips", () => {
  it("keeps everything when both chip lists are empty", () => {
    expect(buildFeedPool(ALL, prefs(), TODAY)).toHaveLength(4);
  });

  it("narrows by type", () => {
    expect(idsIn(buildFeedPool(ALL, prefs({ types: ["quote"] }), TODAY))).toEqual(["quote"]);
  });

  it("narrows by category, case-insensitively on the trimmed string", () => {
    expect(idsIn(buildFeedPool(ALL, prefs({ categories: ["  language "] }), TODAY))).toEqual([
      "due",
      "later",
    ]);
  });

  it("stacks type and category narrowing", () => {
    const stacked = prefs({ types: ["note"], categories: ["Language"] });
    expect(idsIn(buildFeedPool(ALL, stacked, TODAY))).toEqual(["due", "later"]);
  });

  it("ignores a stale category rather than emptying the feed", () => {
    const stale = prefs({ categories: ["Retired"] });
    expect(buildFeedPool(ALL, stale, TODAY)).toHaveLength(4);
  });

  it("keeps the live half of a part-stale category list", () => {
    const mixed = prefs({ categories: ["Retired", "Stoicism"] });
    expect(idsIn(buildFeedPool(ALL, mixed, TODAY))).toEqual(["quote"]);
  });
});

describe("countFeedDue", () => {
  it("counts the due-mode pool, so the row's number is the set it yields", () => {
    expect(countFeedDue(ALL, prefs({ mode: "mix" }), TODAY)).toBe(1);
    expect(countFeedDue(ALL, prefs({ mode: "read" }), TODAY)).toBe(1);
    expect(countFeedDue(ALL, prefs({ mode: "due" }), TODAY)).toBe(
      buildFeedPool(ALL, prefs({ mode: "due" }), TODAY).length,
    );
  });

  it("respects the chips", () => {
    expect(countFeedDue(ALL, prefs({ categories: ["Stoicism"] }), TODAY)).toBe(0);
  });
});
