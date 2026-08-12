import { describe, expect, it } from "vitest";
import {
  cardPrefsCreateSchema,
  cardPrefsSchema,
  DEFAULT_CARD_PREFS,
  isCardCategoryIncluded,
  isCardTypeIncluded,
} from "../card-prefs";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("cardPrefs", {
  schema: cardPrefsSchema,
  createSchema: cardPrefsCreateSchema,
  valid: {
    id: "feed",
    mode: "mix",
    types: ["note", "vocabulary"],
    categories: ["Language"],
    view: "rows",
    migratedAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T10:00:00.000Z",
    fieldUpdatedAt: {},
  },
});

describe("cardPrefs", () => {
  it("has one id and rejects any other", () => {
    expect(DEFAULT_CARD_PREFS.id).toBe("feed");
    expect(cardPrefsSchema.safeParse({ ...DEFAULT_CARD_PREFS, id: "other" }).success).toBe(false);
  });

  it("defaults to mixing everything, in rows, unmigrated", () => {
    expect(DEFAULT_CARD_PREFS).toMatchObject({
      mode: "mix",
      types: [],
      categories: [],
      view: "rows",
      migratedAt: null,
    });
  });

  it("carries the migration stamp, defaulting to null on a record that has none", () => {
    const parsed = cardPrefsCreateSchema.safeParse({ id: "feed" });
    expect(parsed.success && parsed.data.migratedAt).toBeNull();
    expect(
      cardPrefsSchema.safeParse({ ...DEFAULT_CARD_PREFS, migratedAt: "2026-08-11T09:00:00.000Z" })
        .success,
    ).toBe(true);
    expect(cardPrefsSchema.safeParse({ ...DEFAULT_CARD_PREFS, migratedAt: 4 }).success).toBe(false);
  });

  it("treats an empty list as all", () => {
    expect(isCardTypeIncluded({ types: [] }, "vocabulary")).toBe(true);
    expect(isCardCategoryIncluded({ categories: [] }, "anything")).toBe(true);
  });

  it("includes only what a non-empty list names", () => {
    expect(isCardTypeIncluded({ types: ["note"] }, "note")).toBe(true);
    expect(isCardTypeIncluded({ types: ["note"] }, "vocabulary")).toBe(false);
  });

  it("matches a category case-insensitively on the trimmed string", () => {
    expect(isCardCategoryIncluded({ categories: ["Language"] }, "  language ")).toBe(true);
    expect(isCardCategoryIncluded({ categories: ["Language"] }, "focus")).toBe(false);
  });
});
