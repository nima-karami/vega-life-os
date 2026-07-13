import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const taskKindSchema = z.enum(["habit", "oneoff"]);
export const taskStatusSchema = z.enum(["open", "todo", "done", "skip"]);
export const taskEnergySchema = z.enum(["charge", "drain", "neutral"]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  title: z.string(),
  kind: taskKindSchema,
  habitId: nullableString,
  goalId: nullableString,
  valueId: nullableString,
  date: nullableString,
  slotDate: nullableString.optional(),
  completedAt: nullableString.optional(),
  time: nullableString,
  durationMin: z.number(),
  status: taskStatusSchema,
  detached: z.boolean(),
  note: z.string(),
  energy: taskEnergySchema.optional(),
  order: z.number(),
});

export const taskSchema = schema;
export const taskCreateSchema = createSchema;
export type Task = z.infer<typeof taskSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskKind = z.infer<typeof taskKindSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskEnergy = z.infer<typeof taskEnergySchema>;
