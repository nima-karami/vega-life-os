import { describe, expect, it } from "vitest";
import { habitCreateSchema, habitSchema } from "../habit";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("habit", {
  schema: habitSchema,
  createSchema: habitCreateSchema,
  valid: {
    id: "h_1",
    name: "Morning run",
    goalId: null,
    valueId: "v_1",
    icon: "run",
    time: "07:00",
    schedule: { type: "weekly", days: [1, 3, 5], interval: 1, anchor: "2026-07-13" },
    durationMin: 30,
    createdAt: "2026-07-01",
    archivedAt: null,
    pausedAt: null,
    resumedAt: null,
    pausedSpans: [],
    tracked: true,
    plan: "",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { name: "2026-07-13T10:00:00.000Z" },
  },
});

describe("habit compass fields", () => {
  const legacy = {
    id: "h_1",
    name: "Run",
    goalId: null,
    valueId: "v_1",
    icon: "run",
    time: null,
    schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-07-13" },
    durationMin: 30,
    createdAt: "2026-07-01",
    archivedAt: null,
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: {},
  };

  it("parses a legacy habit as tracked with an empty plan", () => {
    const out = habitSchema.parse(legacy);
    expect(out.tracked).toBe(true);
    expect(out.plan).toBe("");
  });

  it("round-trips tracked:false", () => {
    expect(habitSchema.parse({ ...legacy, tracked: false }).tracked).toBe(false);
  });

  it("rejects a plan over 200 characters", () => {
    expect(habitSchema.safeParse({ ...legacy, plan: "x".repeat(201) }).success).toBe(false);
  });
});
