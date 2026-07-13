import { z } from "zod";

/** Server-owned stamps present on every stored record, absent from create input. */
export const recordMetaFields = {
  updatedAt: z.string(),
  fieldUpdatedAt: z.record(z.string(), z.string()),
};

export const nullableString = z.string().nullable();

/**
 * Builds the stored + create pair from one field list: `createSchema` is the
 * client-settable input; `schema` adds the server-owned meta. `.strict()` on both
 * so unknown/extra keys are rejected at the tRPC boundary.
 */
export function defineEntity<Fields extends z.ZodRawShape>(fields: Fields) {
  const createSchema = z.object(fields).strict();
  const schema = z.object({ ...fields, ...recordMetaFields }).strict();
  return { schema, createSchema };
}
