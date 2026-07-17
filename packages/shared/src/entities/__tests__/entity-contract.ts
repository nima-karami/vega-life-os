import { describe, expect, it } from "vitest";
import type { z } from "zod";

type EntityContract = {
  schema: z.ZodTypeAny;
  createSchema: z.ZodTypeAny;
  valid: Record<string, unknown>;
};

/** The shared per-entity contract: valid round-trips, unknown keys stripped (not
 *  rejected — the client upserts whole stored records), create input drops the
 *  server-set stamps rather than 400ing on them. */
export function describeEntityContract(
  name: string,
  { schema, createSchema, valid }: EntityContract,
) {
  describe(name, () => {
    it("accepts a valid record", () => {
      expect(schema.parse(valid)).toMatchObject(valid);
    });

    it("strips an unknown field instead of rejecting", () => {
      const parsed = schema.safeParse({ ...valid, bogus: 1 });
      expect(parsed.success).toBe(true);
      expect(Object.keys((parsed.data ?? {}) as object)).not.toContain("bogus");
    });

    it("create input accepts a record carrying the server-set stamps, stripping them", () => {
      const { updatedAt, fieldUpdatedAt, ...validCreate } = valid;
      expect(createSchema.safeParse(validCreate).success).toBe(true);
      const parsed = createSchema.safeParse({ ...validCreate, updatedAt, fieldUpdatedAt });
      expect(parsed.success).toBe(true);
      const keys = Object.keys((parsed.data ?? {}) as object);
      expect(keys).not.toContain("updatedAt");
      expect(keys).not.toContain("fieldUpdatedAt");
    });
  });
}
