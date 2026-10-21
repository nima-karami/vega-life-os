import { describe, expect, it } from "vitest";
import { valueCreateSchema, valueSchema } from "../value";
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
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { name: "2026-07-13T10:00:00.000Z" },
  },
});

describe("value restingAt", () => {
  it("parses a legacy value as in season", () => {
    const out = valueSchema.parse({
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
    });
    expect(out.restingAt).toBeNull();
  });
});
