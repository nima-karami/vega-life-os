import { CARD_TYPE_IDS, cardPrefsSchema, cardSchema } from "@vega/shared";
import { startOfWeek } from "date-fns";
import { describe, expect, it } from "vitest";
import { buildCardPrefs, buildCards } from "../cards";
import { iso } from "../helpers";

const REF = new Date("2026-08-11T09:00:00.000Z");
const WEEK_START = startOfWeek(REF, { weekStartsOn: 1 });

describe("buildCards", () => {
  const cards = buildCards(REF, WEEK_START);

  it("covers every registered type", () => {
    expect([...new Set(cards.map((c) => c.type))].sort()).toEqual([...CARD_TYPE_IDS].sort());
  });

  it("every card parses against the stored card schema", () => {
    for (const card of cards) {
      const parsed = cardSchema.safeParse(card);
      expect(parsed.success, `${card.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it("gives every card a non-empty title and body", () => {
    for (const card of cards) {
      expect(card.title.trim(), card.id).not.toBe("");
      expect(card.body.trim(), card.id).not.toBe("");
    }
  });

  it("uses unique ids", () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it("demonstrates all three feed steps — open, folded and graded", () => {
    expect(cards.some((c) => c.type === "prompt" && c.box === null)).toBe(true);
    expect(cards.some((c) => c.type === "note" && c.box === null)).toBe(true);
    expect(cards.some((c) => c.box !== null && c.nextDue !== null)).toBe(true);
  });

  it("keeps a due card and a hidden card so the stats line and the hidden row have something to show", () => {
    expect(cards.some((c) => c.nextDue !== null && c.nextDue <= "2026-08-11")).toBe(true);
    expect(cards.some((c) => c.hiddenAt !== null)).toBe(true);
  });

  it("anchors one card to the start of the current week", () => {
    expect(cards.some((c) => c.addedAt === iso(WEEK_START))).toBe(true);
  });
});

describe("buildCardPrefs", () => {
  it("is one unfiltered, unstamped feed record", () => {
    const prefs = buildCardPrefs();
    expect(prefs).toHaveLength(1);
    expect(cardPrefsSchema.safeParse(prefs[0]).success).toBe(true);
    expect(prefs[0]).toMatchObject({
      id: "feed",
      mode: "mix",
      view: "rows",
      types: [],
      categories: [],
      migratedAt: null,
    });
  });
});
