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
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { name: "2026-07-13T10:00:00.000Z" },
  },
});
