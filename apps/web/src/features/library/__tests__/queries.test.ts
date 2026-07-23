import { describe, expect, it } from "vitest";
import type { VocabEntry } from "../model";
import { computeVocabStats, DEFAULT_VOCAB_SORT, isVocabDue, queryVocab } from "../queries";

const TODAY = "2026-07-23";

const entry = (over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: over.id ?? "w1",
  term: "petrichor",
  definition: "the smell after rain",
  example: "",
  phonetic: "",
  examples: [],
  synonyms: [],
  language: "English",
  box: 1,
  lastReviewed: null,
  nextDue: null,
  addedAt: "2026-07-01",
  ...over,
});

const words = [
  entry({
    id: "w1",
    term: "saudade",
    language: "Portuguese",
    box: 2,
    nextDue: "2026-07-20",
    addedAt: "2026-07-10",
    synonyms: ["longing"],
  }),
  entry({
    id: "w2",
    term: "ataraxia",
    language: "Greek",
    box: 4,
    nextDue: "2026-08-01",
    addedAt: "2026-07-12",
    definition: "serene calm",
  }),
  entry({
    id: "w3",
    term: "sonder",
    language: "English",
    box: 1,
    nextDue: null,
    addedAt: "2026-07-11",
  }),
];

const queryAll = (over: Partial<Parameters<typeof queryVocab>[1]> = {}) =>
  queryVocab(words, { query: "", filter: "all", sort: DEFAULT_VOCAB_SORT, today: TODAY, ...over });

describe("isVocabDue", () => {
  it("is due when nextDue is today or earlier, never when null", () => {
    expect(isVocabDue(words[0], TODAY)).toBe(true);
    expect(isVocabDue(words[1], TODAY)).toBe(false);
    expect(isVocabDue(words[2], TODAY)).toBe(false);
  });
});

describe("queryVocab", () => {
  it("defaults to newest-added first", () => {
    expect(queryAll().map((w) => w.id)).toEqual(["w2", "w3", "w1"]);
  });

  it("filters to due words", () => {
    expect(queryAll({ filter: "due" }).map((w) => w.id)).toEqual(["w1"]);
  });

  it("searches term, definition, and synonyms", () => {
    expect(queryAll({ query: "sonder" }).map((w) => w.id)).toEqual(["w3"]);
    expect(queryAll({ query: "serene" }).map((w) => w.id)).toEqual(["w2"]);
    expect(queryAll({ query: "longing" }).map((w) => w.id)).toEqual(["w1"]);
  });

  it("sorts by term in both directions", () => {
    const ascending = queryAll({ sort: { column: "term", direction: "asc" } });
    expect(ascending.map((w) => w.term)).toEqual(["ataraxia", "saudade", "sonder"]);
    const descending = queryAll({ sort: { column: "term", direction: "desc" } });
    expect(descending.map((w) => w.term)).toEqual(["sonder", "saudade", "ataraxia"]);
  });

  it("sorts by box and by language", () => {
    expect(queryAll({ sort: { column: "box", direction: "desc" } })[0].id).toBe("w2");
    expect(queryAll({ sort: { column: "language", direction: "asc" } })[0].language).toBe(
      "English",
    );
  });

  it("sorts by due date with unscheduled words last", () => {
    const rows = queryAll({ sort: { column: "due", direction: "asc" } });
    expect(rows.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
  });
});

describe("computeVocabStats", () => {
  it("counts words and due-today", () => {
    expect(computeVocabStats(words, TODAY)).toEqual({ words: 3, dueToday: 1 });
  });
});
