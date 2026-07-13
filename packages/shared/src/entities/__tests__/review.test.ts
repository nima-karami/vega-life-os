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
