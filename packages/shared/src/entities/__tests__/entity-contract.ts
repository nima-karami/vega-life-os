import { describe, expect, it } from "vitest";
import type { z } from "zod";

type EntityContract = {
  schema: z.ZodTypeAny;
  createSchema: z.ZodTypeAny;
  valid: Record<string, unknown>;
};

/** The shared per-entity contract: valid round-trips, unknown keys rejected,
 *  create input forbids the server-set stamps. */
export function describeEntityContract(
  name: string,
  { schema, createSchema, valid }: EntityContract,
) {
  describe(name, () => {
    it("accepts a valid record", () => {
      expect(schema.parse(valid)).toMatchObject(valid);
    });

    it("rejects an unknown field", () => {
      expect(schema.safeParse({ ...valid, bogus: 1 }).success).toBe(false);
    });

    it("create input forbids the server-set stamps", () => {
      const { updatedAt, fieldUpdatedAt, ...validCreate } = valid;
      expect(createSchema.safeParse(validCreate).success).toBe(true);
      expect(createSchema.safeParse({ ...validCreate, updatedAt }).success).toBe(false);
      expect(createSchema.safeParse({ ...validCreate, fieldUpdatedAt }).success).toBe(false);
    });
  });
}
