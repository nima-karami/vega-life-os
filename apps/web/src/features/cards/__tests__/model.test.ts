import { describe, expect, it } from "vitest";
import {
  buildMetaId,
  buildVocabCardId,
  isSameCategory,
  matchKey,
  normalizeCategory,
} from "../model";

describe("category keys", () => {
  it("normalizes by trimming and matches case-insensitively", () => {
    expect(normalizeCategory("  focus  ")).toBe("focus");
    expect(matchKey("  Focus ")).toBe("focus");
    expect(isSameCategory("Focus", " focus")).toBe(true);
    expect(isSameCategory("Focus", "other")).toBe(false);
  });
});

describe("retired mindMeta keys", () => {
  it("rebuilds the id a hide row for a vocabulary entry was written with", () => {
    expect(buildVocabCardId("w1")).toBe("d:vocab:w1");
    expect(buildMetaId("hide", buildVocabCardId("w1"))).toBe("hide:d:vocab:w1");
    expect(buildMetaId("category", "  Mental Models ")).toBe("category:mental models");
  });
});
