import { taskCreateSchema, taskSchema } from "../task";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("task", {
  schema: taskSchema,
  createSchema: taskCreateSchema,
  valid: {
    id: "t_1",
    title: "Write the plan",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v_1",
    date: "2026-07-13",
    slotDate: null,
    completedAt: null,
    time: "09:00",
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    energy: "neutral",
    order: 0,
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { title: "2026-07-13T10:00:00.000Z" },
  },
});
