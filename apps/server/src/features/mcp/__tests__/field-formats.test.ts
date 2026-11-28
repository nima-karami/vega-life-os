import { describe, expect, it } from "vitest";
import { RECORD_ID_PATTERN } from "../mcp-collections";
import { parsePatch } from "../ops/plan-support";

const rejects = (collection: Parameters<typeof parsePatch>[0], patch: Record<string, unknown>) =>
  expect(() => parsePatch(collection, patch)).toThrow(
    expect.objectContaining({ code: "BAD_REQUEST" }),
  );

describe("agent field formats", () => {
  it.each([
    "9:00",
    "09:00:00",
    "9am",
    "24:00",
  ])("refuses a task time of %j, which calendar sync can't parse", (time) => {
    rejects("tasks", { time });
  });

  it.each([
    ["tasks", { date: "2026-11-31" }],
    ["tasks", { slotDate: "tomorrow" }],
    ["tasks", { completedAt: "2026-11-20 08:00" }],
    ["habits", { time: "7:30" }],
    ["goals", { end: "Q4 2026" }],
    ["tasks", { durationMin: -30 }],
    ["tasks", { durationMin: 1e13 }],
    ["habits", { createdAt: "sometime last week" }],
    [
      "habits",
      { schedule: { type: "weekly", days: [1, 3, 5], interval: 1, anchor: "2026-11-02" } },
    ],
    [
      "habits",
      { schedule: { type: "weekly", days: [1, 0, 1, 0, 1, 0, 0], interval: 2, anchor: "soon" } },
    ],
    [
      "habits",
      {
        schedule: {
          type: "weekly",
          days: [1, 0, 1, 0, 1, 0, 0],
          interval: 0.5,
          anchor: "2026-11-02",
        },
      },
    ],
    ["habits", { schedule: { type: "monthly", daysOfMonth: [0, 45], lastDay: false } }],
    ["goals", { progress: 50 }],
    [
      "goals",
      {
        subgoals: [
          { id: "s_1", name: "a", done: false },
          { id: "s_1", name: "b", done: true },
        ],
      },
    ],
    ["goals", { subgoals: [{ id: "s_1", name: " ", done: false }] }],
    ["values", { archivedAt: "" }],
    ["journal", { mood: 8 }],
    ["journal", { mood: 2.5 }],
    ["journal", { gratitude: ["a", "b", "c", "d"] }],
    ["reviews", { createdAt: "junk" }],
    ["cards", { box: 2.5 }],
    ["cards", { nextDue: "soon" }],
    ["cards", { addedAt: "" }],
    ["financeTransactions", { amountCents: 19.99 * 100 }],
    ["financeTransactions", { txnDate: "11/27/2026" }],
    ["financeTransactions", { txnDate: "2026-11-31" }],
    ["financeBudgets", { cents: 10.5 }],
    ["financeSettlements", { settledAt: "yesterday" }],
    ["financeMerchants", { defaultSpreadMonths: 48 }],
  ] as const)("refuses %s %j", (collection, patch) => {
    rejects(collection, patch);
  });

  it.each([
    [
      "habits",
      {
        schedule: {
          type: "weekly",
          days: [1, 0, 1, 0, 1, 0, 0],
          interval: 2,
          anchor: "2026-11-02",
        },
      },
    ],
    ["habits", { schedule: { type: "monthly", daysOfMonth: [1, 15, 31], lastDay: true } }],
    ["habits", { createdAt: "2026-11-02T10:00:00.000Z" }],
    ["goals", { progress: 0.4 }],
    ["journal", { mood: null }],
    ["financeTransactions", { amountCents: -1999, txnDate: "2026-11-27" }],
    ["financeSettlements", { settledAt: "2026-11-27", paidAt: null }],
    ["cards", { box: 3, nextDue: "2026-11-30", addedAt: "2026-11-20" }],
  ] as const)("accepts %s %j", (collection, patch) => {
    expect(() => parsePatch(collection, patch)).not.toThrow();
  });

  it("names the expected format in the error", () => {
    expect(() => parsePatch("tasks", { time: "9:00" })).toThrow("tasks.time: expected HH:mm");
  });

  it("accepts the app's own formats and null", () => {
    expect(
      parsePatch("tasks", {
        date: "2026-11-28",
        time: "09:00",
        slotDate: null,
        completedAt: "2026-11-28T09:30:00",
      }).fields,
    ).toEqual({
      date: "2026-11-28",
      time: "09:00",
      slotDate: null,
      completedAt: "2026-11-28T09:30:00",
    });
  });
});

describe("record ids", () => {
  it.each(["__x__", "__name__", ".", ".."])("refuses the reserved id %j", (id) => {
    expect(RECORD_ID_PATTERN.test(id)).toBe(false);
  });

  it("accepts ids that only start or end with underscores", () => {
    expect(RECORD_ID_PATTERN.test("__draft")).toBe(true);
    expect(RECORD_ID_PATTERN.test("t_h_run_2026-11-20")).toBe(true);
  });
});
