import { describe, expect, it } from "vitest";
import type { Value } from "@/features/values/model";
import { pickDefaultValueId } from "../default-value";

const RESTING = "2026-10-01T00:00:00.000Z";

function values(...rows: Array<{ id: string; restingAt?: string | null }>): Value[] {
  return rows.map((row) => ({ archivedAt: null, restingAt: null, ...row })) as unknown as Value[];
}

describe("pickDefaultValueId", () => {
  it("prefers the first in-season value", () => {
    expect(pickDefaultValueId(values({ id: "v1", restingAt: RESTING }, { id: "v2" }))).toBe("v2");
  });

  it("falls back to the first value when all are resting", () => {
    expect(pickDefaultValueId(values({ id: "v1", restingAt: RESTING }))).toBe("v1");
  });

  it("is empty with no values", () => {
    expect(pickDefaultValueId([])).toBe("");
  });
});
