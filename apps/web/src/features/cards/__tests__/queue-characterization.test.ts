import { describe, expect, it } from "vitest";
import { buildFeedQueue, type QueueOptions } from "../queue";
import { buildSyntheticPool, hashSequence, POOL_TODAY, type PoolShape } from "./queue-pools";

type PinnedCase = {
  name: string;
  shape: PoolShape;
  options: Omit<QueueOptions, "today">;
  expected: string;
};

const SIX = ["topic a", "topic b", "Topic C", " topic c ", "topic d", "topic e", "topic f"];
const TWELVE = [
  "topic g",
  "topic c",
  "topic h",
  "topic i",
  "topic j",
  "topic d",
  "topic k",
  "topic b",
  "topic l",
  "topic e",
  "",
  "topic f",
];

// Pinned from the quadratic planner the rewrite replaced: the order, not just its properties.
const PINNED: PinnedCase[] = [
  {
    name: "three even categories",
    shape: { size: 30, seed: 1, categories: ["alpha", "beta", "gamma"] },
    options: { seed: 1 },
    expected:
      "p14 p8 p18 p6 p22 p1 p17 p0 p16 p19 p3 p29 p27 p9 p28 p21 p24 p5 p15 p20 p10 p23 p7 p11 p2 p13 p4 p12 p25 p26 recap:1",
  },
  {
    name: "a lopsided deck that engages the share cap and a due backlog past the review set",
    shape: { size: 90, seed: 7, categories: SIX, skew: [8, 1, 1, 1, 1, 2, 1], dueShare: 0.4 },
    options: { seed: 7 },
    expected:
      "p49 p4 p2 p64 p37 p11 p0 p82 p89 p12 p56 p48 p59 p43 p39 p44 p70 p26 p83 p5 p33 p35 p58 p20 p30 p74 p46 p86 p60 p65 p19 p16 p71 p42 p18 p28 p25 p50 p24 p81 p21 p78 p15 p13 p14 p34 p57 p73 p7 p84 p53 p63 p68 p88 p61 p79 p72 p6 p23 p32 p41 p1 p10 p51 p38 p45 p31 p62 p66 p54 p22 p40 p8 p27 p47 p3 recap:7",
  },
  {
    name: "two categories forty to five, so the interleave guard has to give",
    shape: { size: 45, seed: 3, categories: ["topic k", "topic b"], skew: [9, 1], dueShare: 0.1 },
    options: { seed: 3 },
    expected:
      "p42 p5 p22 p32 p0 p13 p20 p3 p36 p21 p24 p10 p14 p30 p11 p38 p33 p23 p37 p40 p15 p29 p9 p28 p25 p39 p19 p1 p41 p8 p44 p31 p16 p27 p4 p12 p34 p2 p6 p18 p43 p26 p35 p17 p7 recap:3",
  },
  {
    name: "a continuation pass excluding the previous tail",
    shape: { size: 50, seed: 9, categories: TWELVE.slice(0, 5) },
    options: { seed: 9, exclude: ["p0", "p3", "p7", "p11", "p12", "p20", "p31", "p40", "p48"] },
    expected:
      "p6 p17 p8 p49 p19 p43 p39 p35 p4 p25 p34 p38 p22 p42 p33 p30 p13 p45 p2 p28 p32 p7 p24 p11 p47 p12 p36 p27 p15 p21 p46 p41 p16 p44 p3 p29 p9 p0 p40 p5 p20 p18 p1 p48 p31 p14 p10 p26 p23 p37 recap:9",
  },
  {
    name: "one category, every card excluded",
    shape: { size: 12, seed: 2, categories: ["solo"] },
    options: { seed: 2, exclude: Array.from({ length: 12 }, (_, index) => `p${index}`) },
    expected: "p10 p1 p3 p9 p11 p8 p0 p4 p5 p2 p6 p7 recap:2",
  },
  {
    name: "nothing due, everything liked",
    shape: { size: 40, seed: 4, categories: TWELVE.slice(0, 4), dueShare: 0, likedShare: 1 },
    options: { seed: 4 },
    expected:
      "p37 p12 p8 p2 p10 p19 p3 p39 p25 p28 p30 p14 p27 p34 p18 p26 p15 p17 p29 p36 p38 p13 p7 p31 p5 p23 p16 p9 p20 p0 p4 p22 p32 p1 p33 p21 p11 p24 p6 recap:4",
  },
];

const PINNED_LARGE: PinnedCase[] = [
  {
    name: "2,000 cards over twelve categories",
    shape: { size: 2000, seed: 5, categories: TWELVE },
    options: { seed: 5 },
    expected: "2001:b6d4dad1",
  },
  {
    name: "2,000 cards, heavily skewed, with an excluded tail",
    shape: { size: 2000, seed: 6, categories: SIX, skew: [20, 1, 3, 3, 1, 1, 6], dueShare: 0.3 },
    options: { seed: 6, exclude: Array.from({ length: 20 }, (_, index) => `p${index * 7}`) },
    expected: "1553:54e5751c",
  },
];

const planIds = (testCase: PinnedCase): string[] =>
  buildFeedQueue(buildSyntheticPool(testCase.shape), {
    ...testCase.options,
    today: POOL_TODAY,
  }).map((entry) => entry.cardId);

describe("buildFeedQueue characterization", () => {
  for (const testCase of PINNED) {
    it(`keeps the planned order — ${testCase.name}`, () => {
      expect(planIds(testCase).join(" ")).toBe(testCase.expected);
    });
  }

  for (const testCase of PINNED_LARGE) {
    it(`keeps the planned order — ${testCase.name}`, () => {
      expect(hashSequence(planIds(testCase))).toBe(testCase.expected);
    });
  }
});
