import { z } from "zod";
import { defineEntity } from "./base";

const { schema, createSchema } = defineEntity({
  id: z.string(),
  kind: z.enum(["hide", "category", "source", "like"]),
  key: z.string(),
  value: z.boolean(),
  setAt: z.string(),
});

export const mindMetaSchema = schema;
export const mindMetaCreateSchema = createSchema;
export type MindMetaRecord = z.infer<typeof mindMetaSchema>;
export type MindMetaRecordCreate = z.infer<typeof mindMetaCreateSchema>;
