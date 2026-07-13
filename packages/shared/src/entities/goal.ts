import { z } from "zod";
import { defineEntity } from "./base";

export const goalStatusSchema = z.enum(["backlog", "active", "paused", "done", "abandoned"]);

export const subgoalSchema = z
  .object({ id: z.string(), name: z.string(), done: z.boolean() })
  .strict();

const { schema, createSchema } = defineEntity({
  id: z.string(),
  valueId: z.string(),
  name: z.string(),
  icon: z.string(),
  status: goalStatusSchema,
  start: z.string(),
  end: z.string(),
  progress: z.number(),
  subgoals: z.array(subgoalSchema),
  order: z.number(),
});

export const goalSchema = schema;
export const goalCreateSchema = createSchema;
export type Goal = z.infer<typeof goalSchema>;
export type GoalCreate = z.infer<typeof goalCreateSchema>;
export type GoalStatus = z.infer<typeof goalStatusSchema>;
export type Subgoal = z.infer<typeof subgoalSchema>;
