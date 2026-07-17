import { z } from "zod";

/** Server-owned stamps present on every stored record, absent from create input. */
export const recordMetaFields = {
  updatedAt: z.string(),
  fieldUpdatedAt: z.record(z.string(), z.string()),
};

export const nullableString = z.string().nullable();

/**
 * Builds the stored + create pair from one field list: `createSchema` is the
 * client-settable input; `schema` adds the server-owned meta. Unknown/extra keys
 * are STRIPPED (Zod's default), not rejected — the client round-trips whole stored
 * records on upsert (carrying server-owned `updatedAt`/`fieldUpdatedAt` and legacy
 * fields), and the server re-stamps the meta itself. Strict rejection here 400s
 * every real write.
 */
export function defineEntity<Fields extends z.ZodRawShape>(fields: Fields) {
  const createSchema = z.object(fields);
  const schema = z.object({ ...fields, ...recordMetaFields });
  return { schema, createSchema };
}
