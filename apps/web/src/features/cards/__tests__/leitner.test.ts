import { describe, expect, it } from "vitest";
import { LEITNER_DAYS, stepLeitner } from "../leitner";

describe("stepLeitner", () => {
  it("bumps the box on correct, capped at 5, and schedules by LEITNER_DAYS", () => {
    expect(stepLeitner(2, true, "2026-07-22")).toEqual({
      box: 3,
      lastReviewed: "2026-07-22",
      nextDue: "2026-07-26", // +LEITNER_DAYS[3] = 4
    });
    expect(stepLeitner(5, true, "2026-07-22").box).toBe(5);
  });

  it("resets to box 1 and stays due today on wrong, from any starting box", () => {
    for (const box of [1, 2, 3, 4, 5]) {
      expect(stepLeitner(box, false, "2026-07-22")).toEqual({
        box: 1,
        lastReviewed: "2026-07-22",
        nextDue: "2026-07-22", // unchanged — comes back this session, not tomorrow
      });
    }
  });

  it("box 1 correct advances to box 2 with a one-day interval", () => {
    expect(LEITNER_DAYS).toEqual([0, 1, 2, 4, 8, 16]);
    expect(stepLeitner(1, true, "2026-07-22")).toEqual({
      box: 2,
      lastReviewed: "2026-07-22",
      nextDue: "2026-07-24", // +LEITNER_DAYS[2] = 2
    });
  });
});
