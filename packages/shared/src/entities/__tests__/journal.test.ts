import { dayEntryCreateSchema, dayEntrySchema } from "../journal";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("journal", {
  schema: dayEntrySchema,
  createSchema: dayEntryCreateSchema,
  valid: {
    id: "day_1",
    date: "2026-07-13",
    gratitude: ["Sunshine", "Coffee"],
    mood: 4,
    journal: "A good day.",
    createdAt: "2026-07-13T08:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { journal: "2026-07-13T10:00:00.000Z" },
  },
});
