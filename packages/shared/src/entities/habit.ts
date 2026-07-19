import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const habitScheduleSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("weekly"),
      days: z.array(z.number()),
      interval: z.number(),
      anchor: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("monthly"),
      daysOfMonth: z.array(z.number()),
      lastDay: z.boolean(),
    })
    .strict(),
]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  name: z.string(),
  goalId: nullableString,
  valueId: z.string(),
  icon: z.string(),
  time: nullableString,
  schedule: habitScheduleSchema,
  durationMin: z.number(),
  createdAt: z.string(),
  archivedAt: nullableString,
  // legacy records predate these — tolerate absence, coercing to null (not paused)
  pausedAt: nullableString.default(null),
  resumedAt: nullableString.default(null),
});

export const habitSchema = schema;
export const habitCreateSchema = createSchema;
export type Habit = z.infer<typeof habitSchema>;
export type HabitCreate = z.infer<typeof habitCreateSchema>;
export type HabitSchedule = z.infer<typeof habitScheduleSchema>;
