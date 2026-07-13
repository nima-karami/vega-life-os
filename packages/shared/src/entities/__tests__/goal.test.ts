import { goalCreateSchema, goalSchema } from "../goal";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("goal", {
  schema: goalSchema,
  createSchema: goalCreateSchema,
  valid: {
    id: "g_1",
    valueId: "v_1",
    name: "Run a half marathon",
    icon: "run",
    status: "active",
    start: "2026-07-01",
    end: "2026-12-31",
    progress: 0.25,
    subgoals: [{ id: "s_1", name: "Run 10k", done: false }],
    order: 0,
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { name: "2026-07-13T10:00:00.000Z" },
  },
});
