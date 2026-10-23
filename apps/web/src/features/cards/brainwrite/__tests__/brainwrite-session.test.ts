import { type Card, type CardPrefs, DEFAULT_CARD_PREFS } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildCard } from "../../__tests__/fixtures";
import { buildFeedPool } from "../../feed-pool";
import { stepLeitner } from "../../leitner";
import { FAILED_REAPPEAR_LIMIT, FAILED_REAPPEAR_OFFSET, NO_REPEAT_WINDOW } from "../../queue";
import { hasClearedToday } from "../../store";
import {
  type DeckPlan,
  extendDeck,
  PASS_CHUNK_SIZE,
  planDeck,
  prunePlannedEntries,
  relocateFailedCard,
  shouldExtendDeck,
} from "../brainwrite-deck";

const TODAY = "2026-08-21";
const BASE_SEED = 0x4d2;
const POOL_SIZE = 120;
const DUE_COUNT = 30;
const CATEGORIES = ["topic a", "topic m", "topic b", "topic c"];

const prefs = (over: Partial<CardPrefs> = {}): CardPrefs => ({ ...DEFAULT_CARD_PREFS, ...over });

/** Every card is in review, so every swipe grades — the deck's two lanes both stay live. */
function buildDrillPool(size = POOL_SIZE): Card[] {
  return Array.from({ length: size }, (_, index) =>
    buildCard({
      id: `v${index}`,
      category: CATEGORIES[index % CATEGORIES.length],
      title: `word ${index}`,
      body: `body ${index}`,
      box: (index % 5) + 1,
      nextDue: index < DUE_COUNT ? TODAY : "2026-09-30",
      lastReviewed: "2026-08-01",
    }),
  );
}

/** A realistic deck shape: a due backlog larger than the review set, the rest read-only. */
function buildBacklogPool(): Card[] {
  return buildDrillPool().map((card, index) =>
    index < DUE_COUNT ? card : { ...card, box: null, nextDue: null, lastReviewed: null },
  );
}

type SessionRun = { seen: string[]; wrongAt: Set<number> };

const gradeInPlace = (cards: Card[], card: Card, correct: boolean): Card[] =>
  cards.map((one) =>
    one.id === card.id
      ? { ...one, ...stepLeitner(card.box ?? 1, correct, TODAY), reviewCount: card.reviewCount + 1 }
      : one,
  );

/**
 * Drives the real planner grade-by-grade the way BrainWritePage does — read the card at the
 * index, grade it, let the deck react, advance, chain a pass when it runs short. The
 * sequence it returns is what a user actually sees.
 */
function replaySession(
  cards: Card[],
  cardPrefs: CardPrefs,
  shouldPass: (step: number) => boolean,
  steps: number,
): SessionRun {
  let live = cards;
  const source = () => ({ cards: live, prefs: cardPrefs, today: TODAY, baseSeed: BASE_SEED });
  let plan: DeckPlan = planDeck(source());
  let index = 0;
  const seen: string[] = [];
  const wrongAt = new Set<number>();

  for (let step = 0; step < steps; step++) {
    if (index >= plan.entries.length) break;
    const pool = buildFeedPool(live, cardPrefs, TODAY);
    const entry = plan.entries[index];
    seen.push(entry.cardId);
    const card = pool.find((one) => one.id === entry.cardId);
    const isGradeable = card !== undefined && card.box !== null && !hasClearedToday(card, TODAY);

    if (isGradeable && card) {
      const correct = shouldPass(step);
      live = gradeInPlace(live, card, correct);
      if (!correct) {
        wrongAt.add(index);
        plan = relocateFailedCard(plan, card.id, index);
      }
    }

    plan = prunePlannedEntries(
      plan,
      new Set(buildFeedPool(live, cardPrefs, TODAY).map((one) => one.id)),
      index,
    );
    index += 1;
    if (shouldExtendDeck(plan, index)) plan = extendDeck(plan, source());
  }

  return { seen, wrongAt };
}

type Repeat = { cardId: string; at: number; gap: number };

function findRepeats(seen: string[]): Repeat[] {
  const lastSeenAt = new Map<string, number>();
  const repeats: Repeat[] = [];
  seen.forEach((cardId, at) => {
    const previous = lastSeenAt.get(cardId);
    if (previous !== undefined && at - previous < NO_REPEAT_WINDOW) {
      repeats.push({ cardId, at, gap: at - previous });
    }
    lastSeenAt.set(cardId, at);
  });
  return repeats;
}

/** The one sanctioned repeat: a card graded wrong, back at its designed offset, within its limit. */
function findUnsanctionedRepeats(run: SessionRun): Repeat[] {
  const sanctionedPerCard = new Map<string, number>();
  return findRepeats(run.seen).filter((repeat) => {
    const count = sanctionedPerCard.get(repeat.cardId) ?? 0;
    const isSanctioned =
      repeat.gap === FAILED_REAPPEAR_OFFSET &&
      run.wrongAt.has(repeat.at - repeat.gap) &&
      count < FAILED_REAPPEAR_LIMIT;
    if (isSanctioned) sanctionedPerCard.set(repeat.cardId, count + 1);
    return !isSanctioned;
  });
}

function expectRepeatsAtDesignedOffset(run: SessionRun): void {
  const repeats = findRepeats(run.seen);
  expect(repeats.length, describeRun(run)).toBeGreaterThan(0);
  for (const repeat of repeats) expect(repeat.gap).toBe(FAILED_REAPPEAR_OFFSET);
}

const describeRun = (run: SessionRun): string =>
  `${new Set(run.seen).size} distinct / ${run.seen.length} — ${run.seen.slice(0, 14).join(" ")}`;

const MODES: { name: string; shouldPass: (step: number) => boolean }[] = [
  { name: "all-correct", shouldPass: () => true },
  { name: "mixed", shouldPass: (step) => step % 3 !== 0 },
  { name: "all-wrong", shouldPass: () => false },
];

const POOLS = [
  { name: "every card in review", build: buildDrillPool },
  { name: "a due backlog over a read-only rest", build: buildBacklogPool },
];

describe("BrainWrite session integrity", () => {
  for (const pool of POOLS) {
    for (const mode of MODES) {
      it(`never repeats a card inside the no-repeat window — ${pool.name}, ${mode.name}`, () => {
        const run = replaySession(pool.build(), prefs(), mode.shouldPass, 60);
        expect(findUnsanctionedRepeats(run), describeRun(run)).toEqual([]);
      });
    }
  }

  it("reaches a due card ranked past the review-set limit inside one pass", () => {
    const run = replaySession(buildBacklogPool(), prefs(), () => true, POOL_SIZE);
    const dueIds = Array.from({ length: DUE_COUNT }, (_, index) => `v${index}`);
    const seen = new Set(run.seen);
    expect(
      dueIds.filter((id) => !seen.has(id)),
      describeRun(run),
    ).toEqual([]);
  });

  it("shows a distinct card per swipe when every grade is correct", () => {
    const run = replaySession(buildDrillPool(), prefs(), () => true, 60);
    expect(new Set(run.seen).size, describeRun(run)).toBe(60);
  });

  // A card seen four times is the designed ceiling: the first showing plus FAILED_REAPPEAR_LIMIT
  // returns. Nothing worse than that, whatever the user does.
  it("keeps drilling a failing deck without collapsing onto a handful of cards", () => {
    for (const pool of POOLS) {
      const run = replaySession(pool.build(), prefs(), () => false, 60);
      expect(new Set(run.seen).size, `${pool.name}: ${describeRun(run)}`).toBeGreaterThanOrEqual(
        60 / (FAILED_REAPPEAR_LIMIT + 1),
      );
    }
  });

  it("keeps the deck moving under every grading mode", () => {
    const counts = MODES.map((mode) => {
      const run = replaySession(buildDrillPool(), prefs(), mode.shouldPass, 60);
      return `${mode.name}: ${new Set(run.seen).size}/60`;
    });
    expect(counts).toEqual(["all-correct: 60/60", "mixed: 41/60", "all-wrong: 15/60"]);
  });

  it("returns a failed card exactly at its designed offset, within its limit", () => {
    expectRepeatsAtDesignedOffset(
      replaySession(buildDrillPool(), prefs(), (step) => step % 3 !== 0, 60),
    );
  });
});

describe("BrainWrite session integrity across pass chunks", () => {
  const LONG_POOL = PASS_CHUNK_SIZE * 3 + 17;
  const LONG_RUN = PASS_CHUNK_SIZE * 2 + 50;

  for (const mode of MODES) {
    it(`never repeats a card inside the no-repeat window — ${mode.name}`, () => {
      const run = replaySession(buildDrillPool(LONG_POOL), prefs(), mode.shouldPass, LONG_RUN);
      expect(findUnsanctionedRepeats(run), describeRun(run)).toEqual([]);
    });
  }

  it("shows a distinct card per swipe across the chunk seams when every grade is correct", () => {
    const run = replaySession(buildDrillPool(LONG_POOL), prefs(), () => true, LONG_RUN);
    expect(new Set(run.seen).size, describeRun(run)).toBe(LONG_RUN);
  });

  it("returns a failed card exactly at its designed offset across the chunk seams", () => {
    expectRepeatsAtDesignedOffset(
      replaySession(buildDrillPool(LONG_POOL), prefs(), (step) => step % 3 !== 0, LONG_RUN),
    );
  });
});
