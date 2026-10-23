import { DEFAULT_CARD_PREFS } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { planDeck } from "../brainwrite/brainwrite-deck";
import { buildFeedQueue } from "../queue";
import { buildSyntheticPool, POOL_TODAY } from "./queue-pools";

const CATEGORIES = ["topic g", "topic c", "topic h", "topic i", "topic j", "topic d", "topic k"];
const WARM_UP_RUNS = 3;
const RUNS = 7;

// Warmed first so the median measures the planner, not the JIT tiering up under a busy suite.
function measureMedianMs(run: (attempt: number) => void): number {
  for (let attempt = 0; attempt < WARM_UP_RUNS; attempt++) run(RUNS + attempt);
  const timings = Array.from({ length: RUNS }, (_, attempt) => {
    const startedAt = performance.now();
    run(attempt);
    return performance.now() - startedAt;
  });
  return timings.sort((a, b) => a - b)[Math.floor(RUNS / 2)];
}

// Budgets carry a wide CI margin; the quadratic planner took ~11 s at 10k and ~52 s at 20k.
describe("deck planning stays sub-quadratic", () => {
  const poolOf = (size: number) =>
    buildSyntheticPool({ size, seed: size, categories: CATEGORIES, dueShare: 0.2 });

  it("plans a whole 10k-card pass in under 50 ms", () => {
    const pool = poolOf(10_000);
    expect(
      measureMedianMs((attempt) => buildFeedQueue(pool, { seed: attempt, today: POOL_TODAY })),
    ).toBeLessThan(50);
  });

  it("plans a whole 20k-card pass in under 100 ms", () => {
    const pool = poolOf(20_000);
    expect(
      measureMedianMs((attempt) => buildFeedQueue(pool, { seed: attempt, today: POOL_TODAY })),
    ).toBeLessThan(100);
  });

  it("opens a 10k-card deck in under 50 ms", () => {
    const cards = poolOf(10_000);
    const source = { cards, prefs: DEFAULT_CARD_PREFS, today: POOL_TODAY };
    expect(measureMedianMs((attempt) => planDeck({ ...source, baseSeed: attempt }))).toBeLessThan(
      50,
    );
  });
});
