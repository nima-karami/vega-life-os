import { type Card, type CardPrefs, DEFAULT_CARD_PREFS } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildCard } from "../../__tests__/fixtures";
import { FAILED_REAPPEAR_LIMIT, FAILED_REAPPEAR_OFFSET, NO_REPEAT_WINDOW } from "../../queue";
import {
  buildBrainWriteQueue,
  type DeckPlan,
  extendDeck,
  PASS_CHUNK_SIZE,
  planDeck,
  prunePlannedEntries,
  relocateFailedCard,
  shouldExtendDeck,
} from "../brainwrite-deck";

const TODAY = "2026-08-20";

const prefs = (over: Partial<CardPrefs> = {}): CardPrefs => ({ ...DEFAULT_CARD_PREFS, ...over });

const deckCards = (count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    buildCard({ id: `c${index}`, title: `C${index}`, body: `body ${index}` }),
  );

const sourceOf = (cards: Card[]) => ({ cards, prefs: prefs(), today: TODAY, baseSeed: 11 });
const idsOf = (plan: DeckPlan): string[] => plan.entries.map((entry) => entry.cardId);

// The same object back is what lets the page's setDeck bail out instead of looping forever.
function expectNoOpOnEmptyPool(cards: Card[]): void {
  const plan = planDeck(sourceOf(cards));
  const allHidden = cards.map((card) => ({ ...card, hiddenAt: "2026-08-20T00:00:00.000Z" }));
  expect(extendDeck(plan, sourceOf(allHidden))).toBe(plan);
}

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

describe("planDeck / extendDeck", () => {
  it("plans one pass over the whole pool and stamps it", () => {
    const plan = planDeck(sourceOf(deckCards(12)));
    expect(plan.passCount).toBe(1);
    expect(new Set(idsOf(plan)).size).toBe(12);
    expect(plan.entries.every((entry) => entry.passIndex === 0)).toBe(true);
  });

  it("appends the next pass without touching what is already planned", () => {
    const cards = deckCards(30);
    const plan = planDeck(sourceOf(cards));
    const extended = extendDeck(plan, sourceOf(cards));
    expect(extended.entries.slice(0, plan.entries.length)).toEqual(plan.entries);
    expect(extended.passCount).toBe(2);
    expect(extended.entries.slice(plan.entries.length).every((e) => e.passIndex === 1)).toBe(true);
  });

  it("holds the no-repeat window across the pass boundary", () => {
    const cards = deckCards(60);
    const extended = extendDeck(planDeck(sourceOf(cards)), sourceOf(cards));
    const ids = idsOf(extended);
    for (let i = 0; i < ids.length; i++) {
      expect(ids.slice(Math.max(0, i - NO_REPEAT_WINDOW), i)).not.toContain(ids[i]);
    }
  });

  it("returns the very same plan when the pool has emptied", () => {
    expectNoOpOnEmptyPool(deckCards(12));
  });

  it("clears the reappearance counts when a pass is crossed", () => {
    const cards = deckCards(30);
    const plan = { ...planDeck(sourceOf(cards)), reappears: { c0: 2 } };
    expect(extendDeck(plan, sourceOf(cards)).reappears).toEqual({});
  });
});

describe("relocateFailedCard", () => {
  it("moves the card's next appearance forward rather than adding one", () => {
    const cards = deckCards(30);
    const plan = extendDeck(planDeck(sourceOf(cards)), sourceOf(cards));
    const failed = idsOf(plan)[3];
    const after = relocateFailedCard(plan, failed, 3);
    expect(idsOf(after).indexOf(failed, 4)).toBe(3 + FAILED_REAPPEAR_OFFSET);
    expect(idsOf(after).lastIndexOf(failed)).toBe(3 + FAILED_REAPPEAR_OFFSET);
    expect(after.entries.length).toBe(plan.entries.length);
    expect(after.reappears[failed]).toBe(1);
  });

  it("leaves everything before the offset where it was", () => {
    const cards = deckCards(30);
    const plan = planDeck(sourceOf(cards));
    const after = relocateFailedCard(plan, idsOf(plan)[3], 3);
    expect(idsOf(after).slice(0, 8)).toEqual(idsOf(plan).slice(0, 8));
  });

  it("inserts a fresh entry when the card has no appearance left in the plan", () => {
    const cards = deckCards(6);
    const plan = planDeck(sourceOf(cards));
    const failed = idsOf(plan)[5];
    const after = relocateFailedCard(plan, failed, 5);
    expect(after.entries.length).toBe(plan.entries.length + 1);
    expect(idsOf(after).at(-1)).toBe(failed);
  });

  it("stops relocating once the per-pass limit is spent", () => {
    const cards = deckCards(30);
    let plan = planDeck(sourceOf(cards));
    const failed = idsOf(plan)[0];
    for (let attempt = 0; attempt < FAILED_REAPPEAR_LIMIT + 2; attempt++) {
      plan = relocateFailedCard(plan, failed, attempt * FAILED_REAPPEAR_OFFSET);
    }
    expect(plan.reappears[failed]).toBe(FAILED_REAPPEAR_LIMIT);
  });

  it("leaves the plan alone when the card is already coming back sooner", () => {
    const cards = deckCards(30);
    const plan = planDeck(sourceOf(cards));
    const soon = idsOf(plan)[2];
    expect(relocateFailedCard(plan, soon, 0)).toBe(plan);
  });
});

describe("prunePlannedEntries", () => {
  it("drops a card that left the pool from what is still ahead", () => {
    const cards = deckCards(12);
    const plan = planDeck(sourceOf(cards));
    const gone = idsOf(plan)[7];
    const live = new Set(idsOf(plan).filter((id) => id !== gone));
    const after = prunePlannedEntries(plan, live, 3);
    expect(idsOf(after)).not.toContain(gone);
    expect(idsOf(after).slice(0, 4)).toEqual(idsOf(plan).slice(0, 4));
  });

  it("keeps what is already behind the user, dead or not", () => {
    const cards = deckCards(12);
    const plan = planDeck(sourceOf(cards));
    const seen = idsOf(plan)[2];
    const after = prunePlannedEntries(plan, new Set(idsOf(plan).filter((id) => id !== seen)), 5);
    expect(idsOf(after)[2]).toBe(seen);
  });

  it("returns the same plan when nothing left the pool", () => {
    const plan = planDeck(sourceOf(deckCards(12)));
    expect(prunePlannedEntries(plan, new Set(idsOf(plan)), 0)).toBe(plan);
  });
});

describe("chunked passes", () => {
  const LONG_POOL = PASS_CHUNK_SIZE * 2 + 30;
  const mixedCards = (count: number): Card[] =>
    Array.from({ length: count }, (_, index) =>
      buildCard({ id: `m${index}`, title: `M${index}`, category: `topic ${index % 5}` }),
    );
  const planWholePass = (cards: Card[]): string[] =>
    buildBrainWriteQueue(cards, prefs(), TODAY, { seed: 11 }).map((entry) => entry.cardId);
  const readOpenPass = (plan: DeckPlan, cards: Card[]): DeckPlan => {
    let read = plan;
    for (;;) {
      const next = extendDeck(read, sourceOf(cards));
      if (next.passCount > read.passCount) return read;
      read = next;
    }
  };

  it("reads a long pass a chunk at a time, in the order a whole pass plans", () => {
    const cards = mixedCards(LONG_POOL);
    const plan = planDeck(sourceOf(cards));
    expect(plan.entries.length).toBe(PASS_CHUNK_SIZE);
    const read = readOpenPass(plan, cards);
    expect(read.passCount).toBe(1);
    expect(idsOf(read)).toEqual(planWholePass(cards));
    expect(read.entries.every((entry) => entry.passIndex === 0)).toBe(true);
  });

  it("opens the next pass only once the open one is read out", () => {
    const cards = mixedCards(LONG_POOL);
    const read = readOpenPass(planDeck(sourceOf(cards)), cards);
    const next = extendDeck(read, sourceOf(cards));
    expect(next.passCount).toBe(2);
    expect(next.entries.slice(0, read.entries.length)).toEqual(read.entries);
  });

  it("keeps a failed card out of the unread rest of its pass", () => {
    const cards = mixedCards(LONG_POOL);
    const unreadId = planWholePass(cards)[PASS_CHUNK_SIZE + 10];
    const relocated = relocateFailedCard(planDeck(sourceOf(cards)), unreadId, 0);
    expect(idsOf(relocated)[FAILED_REAPPEAR_OFFSET]).toBe(unreadId);
    const read = readOpenPass(relocated, cards);
    expect(idsOf(read).filter((id) => id === unreadId)).toHaveLength(1);
  });

  it("drops a card that left the pool from a chunk not yet read", () => {
    const cards = mixedCards(LONG_POOL);
    const goneId = planWholePass(cards)[PASS_CHUNK_SIZE + 3];
    const withoutGone = cards.map((card) =>
      card.id === goneId ? { ...card, hiddenAt: "2026-08-20T00:00:00.000Z" } : card,
    );
    const extended = extendDeck(planDeck(sourceOf(cards)), sourceOf(withoutGone));
    expect(extended.entries.length).toBeGreaterThan(PASS_CHUNK_SIZE);
    expect(idsOf(extended)).not.toContain(goneId);
  });

  it("returns the very same plan when the pool empties with chunks still unread", () => {
    expectNoOpOnEmptyPool(mixedCards(LONG_POOL));
  });

  it("chains the next chunk early enough to hold a failed card's return slot", () => {
    const long = planDeck(sourceOf(mixedCards(LONG_POOL)));
    const chunkLead = 2 * FAILED_REAPPEAR_OFFSET;
    expect(shouldExtendDeck(long, PASS_CHUNK_SIZE - chunkLead - 1)).toBe(false);
    expect(shouldExtendDeck(long, PASS_CHUNK_SIZE - chunkLead)).toBe(true);
    const short = planDeck(sourceOf(deckCards(12)));
    expect(shouldExtendDeck(short, 9)).toBe(false);
    expect(shouldExtendDeck(short, 10)).toBe(true);
  });
});
