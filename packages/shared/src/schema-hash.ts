import { z } from "zod";
import { schemasByCollection } from "./collections";
import { profilePatchSchema } from "./profile";

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function sortKeysDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sortKeysDeep);
  if (node === null || typeof node !== "object") return node;
  const entries = Object.entries(node).sort(([left], [right]) => (left < right ? -1 : 1));
  return Object.fromEntries(entries.map(([key, child]) => [key, sortKeysDeep(child)]));
}

function hashFnv1a64(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

export function computeSchemaHash(schemasByName: Record<string, z.ZodType>): string {
  const canonical = Object.keys(schemasByName)
    .sort()
    .map((name) => [
      name,
      sortKeysDeep(z.toJSONSchema(schemasByName[name], { unrepresentable: "any" })),
    ]);
  return hashFnv1a64(JSON.stringify(canonical)).slice(0, 12);
}

/** Server and web builds compare this to catch a hosting deploy ahead of the server it writes to. */
export const SCHEMA_HASH = /* @__PURE__ */ computeSchemaHash({
  ...schemasByCollection,
  profilePatch: profilePatchSchema,
});
