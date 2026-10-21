import { describe, expect, it } from "vitest";
import { z } from "zod";
import { schemasByCollection } from "../collections";
import { valueSchema } from "../entities/value";
import { profilePatchSchema } from "../profile";
import { computeSchemaHash, SCHEMA_HASH } from "../schema-hash";

const liveSchemas = { ...schemasByCollection, profilePatch: profilePatchSchema };

describe("SCHEMA_HASH", () => {
  it("is a 12-char hex digest that recomputes identically", () => {
    expect(SCHEMA_HASH).toMatch(/^[0-9a-f]{12}$/);
    expect(computeSchemaHash(liveSchemas)).toBe(SCHEMA_HASH);
  });

  it("ignores the order the schemas are listed in", () => {
    const reversed = Object.fromEntries(Object.entries(liveSchemas).reverse());
    expect(computeSchemaHash(reversed)).toBe(SCHEMA_HASH);
  });

  it("changes when an entity gains a field", () => {
    const widened = { ...liveSchemas, values: valueSchema.extend({ season: z.string() }) };
    expect(computeSchemaHash(widened)).not.toBe(SCHEMA_HASH);
  });

  it("changes when a field's type or optionality changes", () => {
    const base = computeSchemaHash({ probe: z.object({ note: z.string() }) });
    expect(computeSchemaHash({ probe: z.object({ note: z.number() }) })).not.toBe(base);
    expect(computeSchemaHash({ probe: z.object({ note: z.string().optional() }) })).not.toBe(base);
  });

  it("changes when a collection is added or removed", () => {
    const { profilePatch: _dropped, ...withoutProfile } = liveSchemas;
    expect(computeSchemaHash(withoutProfile)).not.toBe(SCHEMA_HASH);
  });
});
