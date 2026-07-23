import { describe, expect, it } from "vitest";
import { listVocabExamples, type VocabEntry } from "../model";

const entry = (over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: "w1",
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

describe("listVocabExamples", () => {
  it("returns the examples list when present", () => {
    const word = entry({ examples: ["first use", "second use"], example: "legacy" });
    expect(listVocabExamples(word)).toEqual(["first use", "second use"]);
  });

  it("drops blank example rows", () => {
    const word = entry({ examples: ["", "  ", "real sentence"] });
    expect(listVocabExamples(word)).toEqual(["real sentence"]);
  });

  it("falls back to the legacy single example", () => {
    expect(listVocabExamples(entry({ example: "old sentence" }))).toEqual(["old sentence"]);
  });

  it("returns empty when neither is set", () => {
    expect(listVocabExamples(entry())).toEqual([]);
  });

  it("tolerates a legacy Dexie record missing the array entirely", () => {
    const { examples: _omitted, ...legacyRecord } = entry({ example: "old sentence" });
    expect(listVocabExamples(legacyRecord as VocabEntry)).toEqual(["old sentence"]);
  });
});
