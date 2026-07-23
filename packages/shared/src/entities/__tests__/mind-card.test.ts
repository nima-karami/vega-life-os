import { expect, it } from "vitest";
import { mindCardCreateSchema, mindCardSchema } from "../mind-card";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("mindCard", {
  schema: mindCardSchema,
  createSchema: mindCardCreateSchema,
  valid: {
    id: "mc_1",
    title: "Inversion",
    body: "**Solve it backward.**",
    type: "model",
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

it("parses pre-taxonomy records with model/flippable/unliked defaults", () => {
  const parsed = mindCardSchema.parse({
    id: "mc_legacy",
    title: "Anchoring",
    body: "",
    category: "biases",
    source: null,
    addedAt: "2026-07-01",
    hiddenAt: null,
    box: null,
    lastReviewed: null,
    nextDue: null,
    updatedAt: "",
    fieldUpdatedAt: {},
  });
  expect(parsed).toMatchObject({ type: "model", flippable: true, likedAt: null });
});
