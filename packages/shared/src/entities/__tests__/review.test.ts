import { describe, expect, it } from "vitest";
import { reviewCreateSchema, reviewSchema } from "../review";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("review", {
  schema: reviewSchema,
  createSchema: reviewCreateSchema,
  valid: {
    id: "r_1",
    periodKey: "2026-07-06",
    prompts: [{ q: "What went well?", a: "Shipped the schemas." }],
    completion: 0.8,
    createdAt: "2026-07-12T18:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { completion: "2026-07-13T10:00:00.000Z" },
  },
});

const meta = { updatedAt: "2026-07-13T10:00:00.000Z", fieldUpdatedAt: {} };
const base = {
  id: "r_2",
  periodKey: "2026-07-13",
  prompts: [],
  createdAt: "2026-07-19T18:00:00.000Z",
  ...meta,
};

describe("review check-ins", () => {
  it("defaults checkIns to [] on a legacy review that carries a completion", () => {
    const parsed = reviewSchema.parse({ ...base, completion: 0.8 });
    expect(parsed.checkIns).toEqual([]);
  });

  it("accepts a review without completion", () => {
    expect(reviewSchema.safeParse(base).success).toBe(true);
  });

  it("accepts ratings 1 to 5", () => {
    const checkIns = [1, 2, 3, 4, 5].map((rating) => ({ valueId: `v${rating}`, rating }));
    expect(reviewSchema.safeParse({ ...base, checkIns }).success).toBe(true);
  });

  it.each([0, 6, 2.5])("rejects rating %s", (rating) => {
    const checkIns = [{ valueId: "v", rating }];
    expect(reviewSchema.safeParse({ ...base, checkIns }).success).toBe(false);
  });

  it("rejects two check-ins for the same value", () => {
    const checkIns = [
      { valueId: "v", rating: 3 },
      { valueId: "v", rating: 4 },
    ];
    expect(reviewSchema.safeParse({ ...base, checkIns }).success).toBe(false);
    expect(reviewCreateSchema.safeParse({ ...base, checkIns }).success).toBe(false);
  });

  it("rejects an unknown key inside a check-in", () => {
    const checkIns = [{ valueId: "v", rating: 3, note: "x" }];
    expect(reviewSchema.safeParse({ ...base, checkIns }).success).toBe(false);
  });
});
