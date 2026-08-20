import { type CardPrefs, DEFAULT_CARD_PREFS } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildCard } from "../../__tests__/fixtures";
import { buildBrainWriteQueue } from "../brainwrite-deck";

const TODAY = "2026-08-20";

const prefs = (over: Partial<CardPrefs> = {}): CardPrefs => ({ ...DEFAULT_CARD_PREFS, ...over });

describe("buildBrainWriteQueue", () => {
  it("never includes a recap entry", () => {
    const cards = [
      buildCard({ id: "a", title: "A" }),
      buildCard({ id: "b", title: "B", box: 3, nextDue: TODAY, lastReviewed: "2026-08-10" }),
    ];
    const entries = buildBrainWriteQueue(cards, prefs(), TODAY, { seed: 1 });
    expect(entries.some((entry) => entry.cardId.startsWith("recap:"))).toBe(false);
    expect(entries.map((entry) => entry.cardId).sort()).toEqual(["a", "b"]);
  });

  it("excludes hidden and out-of-scope cards via buildFeedPool", () => {
    const cards = [
      buildCard({ id: "shown", title: "Shown" }),
      buildCard({ id: "hidden", title: "Hidden", hiddenAt: "2026-08-01T00:00:00.000Z" }),
    ];
    const entries = buildBrainWriteQueue(cards, prefs(), TODAY, { seed: 1 });
    expect(entries.map((entry) => entry.cardId)).toEqual(["shown"]);
  });

  it("is deterministic under a seed", () => {
    const cards = Array.from({ length: 8 }, (_, i) => buildCard({ id: `c${i}`, title: `C${i}` }));
    const first = buildBrainWriteQueue(cards, prefs(), TODAY, { seed: 42 });
    const second = buildBrainWriteQueue(cards, prefs(), TODAY, { seed: 42 });
    expect(first).toEqual(second);
  });

  it("passes reinsert through to the underlying queue build", () => {
    const cards = [
      buildCard({ id: "a", title: "A" }),
      buildCard({ id: "b", title: "B" }),
      buildCard({ id: "c", title: "C" }),
    ];
    const entries = buildBrainWriteQueue(cards, prefs(), TODAY, {
      seed: 1,
      reinsert: { cardId: "a", offset: 1 },
    });
    expect(entries[1]?.cardId).toBe("a");
  });

  it("respects a due-only prefs mode", () => {
    const cards = [
      buildCard({ id: "due", title: "Due", box: 2, nextDue: TODAY, lastReviewed: "2026-08-01" }),
      buildCard({ id: "notdue", title: "Not due" }),
    ];
    const entries = buildBrainWriteQueue(cards, prefs({ mode: "due" }), TODAY, { seed: 1 });
    expect(entries.map((entry) => entry.cardId)).toEqual(["due"]);
  });

  it("keeps a due learning card ahead of the rest of the mix", () => {
    const cards = [
      buildCard({ id: "r1", title: "R1" }),
      buildCard({ id: "r2", title: "R2" }),
      buildCard({ id: "due", title: "Due", box: 4, nextDue: TODAY, lastReviewed: "2026-08-01" }),
    ];
    const entries = buildBrainWriteQueue(cards, prefs(), TODAY, { seed: 7 });
    expect(entries[0]?.cardId).toBe("due");
  });
});
