import { describe, expect, it } from "vitest";
import { VALUE_IDENTITY_MAX, valueCreateSchema, valueSchema } from "../value";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("value", {
  schema: valueSchema,
  createSchema: valueCreateSchema,
  valid: {
    id: "v_1",
    name: "Health",
    icon: "heart",
    hue: "0 0% 20%",
    spectrum: "emerald",
    energy: 0.6,
    desc: "Move daily",
    order: 0,
    archivedAt: null,
    restingAt: null,
    identity: "You're someone who moves.",
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { name: "2026-07-13T10:00:00.000Z" },
  },
});

const legacyValue = {
  id: "v_1",
  name: "Health",
  icon: "heart",
  hue: "h",
  spectrum: "s",
  energy: 0.5,
  desc: "",
  order: 0,
  archivedAt: null,
  updatedAt: "2026-07-13T10:00:00.000Z",
  fieldUpdatedAt: {},
};

describe("value restingAt", () => {
  it("parses a legacy value as in season", () => {
    expect(valueSchema.parse(legacyValue).restingAt).toBeNull();
  });
});

describe("value identity", () => {
  it("parses a legacy value with an empty identity line", () => {
    expect(valueSchema.parse(legacyValue).identity).toBe("");
  });

  it("caps the identity line at 120 characters", () => {
    expect(VALUE_IDENTITY_MAX).toBe(120);
    const atCap = { ...legacyValue, identity: "x".repeat(120) };
    const pastCap = { ...legacyValue, identity: "x".repeat(121) };
    expect(valueSchema.safeParse(atCap).success).toBe(true);
    expect(valueSchema.safeParse(pastCap).success).toBe(false);
  });
});
