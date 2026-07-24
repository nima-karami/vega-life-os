import { describe, expect, it } from "vitest";
import { mindCardCreateSchema, mindCardSchema } from "../mind-card";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("mindCard", {
  schema: mindCardSchema,
  createSchema: mindCardCreateSchema,
  valid: {
    id: "mc_1",
    title: "Inversion",
    body: "**Solve it backward.**",
    type: "note",
    origin: "manual",
    category: "thinking",
    source: null,
    addedAt: "2026-07-01",
    hiddenAt: null,
    likedAt: null,
    flippable: true,
    box: 1,
    lastReviewed: null,
    nextDue: "2026-07-02",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: {},
  },
});

const base = {
  id: "mc_1",
  title: "Inversion",
  body: "Solve it backward.",
  category: "mental models",
  source: null,
  addedAt: "2026-07-01",
  hiddenAt: null,
  box: null,
  lastReviewed: null,
  nextDue: null,
  updatedAt: "",
  fieldUpdatedAt: {},
};

describe("mind card schema v2", () => {
  it("defaults type to note and origin to manual", () => {
    const parsed = mindCardSchema.parse(base);
    expect(parsed.type).toBe("note");
    expect(parsed.origin).toBe("manual");
  });

  it("accepts an external origin", () => {
    expect(mindCardSchema.parse({ ...base, origin: "external" }).origin).toBe("external");
  });

  it("maps every legacy type onto the new taxonomy", () => {
    const cases: [string, string][] = [
      ["model", "note"],
      ["fact", "note"],
      ["principle", "note"],
      ["affirmation", "note"],
      ["aspiration", "note"],
      ["reminder", "note"],
      ["excerpt", "quote"],
      ["quote", "quote"],
      ["prompt", "prompt"],
    ];
    for (const [stored, expected] of cases) {
      expect(mindCardSchema.parse({ ...base, type: stored }).type).toBe(expected);
    }
  });

  it("accepts the three current types", () => {
    for (const type of ["note", "quote", "prompt"]) {
      expect(mindCardSchema.parse({ ...base, type }).type).toBe(type);
    }
  });
});
