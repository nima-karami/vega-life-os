import { type Card, DEFAULT_CARD_PREFS } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildLegacyFeedPool, resolveBodyVariant, toFeedCard } from "../feed-cards";
import { buildCard } from "./fixtures";

const TODAY = "2026-08-11";

const card = (over: Partial<Card> = {}): Card => buildCard(over);

describe("toFeedCard", () => {
  it("carries a note straight through", () => {
    expect(toFeedCard(card(), TODAY)).toMatchObject({
      id: "c_1",
      type: "note",
      title: "Inversion",
      body: "Solve it backward.",
      hasReveal: true,
      learning: false,
      due: false,
      liked: false,
      bodyVariants: null,
      maskedBody: null,
      subtitle: null,
    });
  });

  it("reads the attribution off author, then work", () => {
    expect(toFeedCard(card({ type: "quote", author: "Seneca" }), TODAY).source).toBe("Seneca");
    expect(toFeedCard(card({ type: "fact", work: "Nature" }), TODAY).source).toBe("Nature");
  });

  it("gives a quote no reveal until it is promoted", () => {
    expect(toFeedCard(card({ type: "quote" }), TODAY).hasReveal).toBe(false);
    expect(toFeedCard(card({ type: "quote", hasRecall: true }), TODAY).hasReveal).toBe(true);
    expect(toFeedCard(card({ type: "excerpt" }), TODAY).hasReveal).toBe(true);
  });

  it("builds one reveal per example for a vocabulary card", () => {
    const feed = toFeedCard(
      card({
        type: "vocabulary",
        category: "Language",
        title: "petrichor",
        body: "The smell after rain.",
        phonetic: "/ˈpɛtrɪˌkɔr/",
        examples: ["First sentence.", "Second sentence."],
        synonyms: ["scent"],
      }),
      TODAY,
    );
    expect(feed.subtitle).toBe("/ˈpɛtrɪˌkɔr/");
    expect(feed.maskedBody).toBe("**The smell after rain.**");
    expect(feed.bodyVariants).toHaveLength(2);
    expect(feed.bodyVariants?.[1]).toContain("Second sentence.");
    expect(feed.bodyVariants?.[0]).toContain("_Synonyms: scent_");
    expect(resolveBodyVariant(feed, 3)).toBe(feed.bodyVariants?.[1]);
  });

  it("is due when the next due date has arrived", () => {
    expect(toFeedCard(card({ box: 1, nextDue: TODAY }), TODAY).due).toBe(true);
    expect(toFeedCard(card({ box: 1, nextDue: "2026-08-12" }), TODAY).due).toBe(false);
  });
});

describe("buildLegacyFeedPool", () => {
  const cards = [
    card({ id: "a", category: "focus" }),
    card({ id: "b", category: "Language", type: "vocabulary", title: "sonder", body: "A word." }),
    card({ id: "hidden", hiddenAt: "2026-08-01T00:00:00.000Z" }),
  ];

  it("drops hidden cards and keeps everything else by default", () => {
    expect(
      buildLegacyFeedPool({ cards, cardPrefs: DEFAULT_CARD_PREFS }, TODAY).map((c) => c.id),
    ).toEqual(["a", "b"]);
  });

  it("honours the type include list", () => {
    const prefs = { ...DEFAULT_CARD_PREFS, types: ["note" as const] };
    expect(buildLegacyFeedPool({ cards, cardPrefs: prefs }, TODAY).map((c) => c.id)).toEqual(["a"]);
  });

  it("honours the category include list, case-insensitively", () => {
    const prefs = { ...DEFAULT_CARD_PREFS, categories: ["language"] };
    expect(buildLegacyFeedPool({ cards, cardPrefs: prefs }, TODAY).map((c) => c.id)).toEqual(["b"]);
  });
});
