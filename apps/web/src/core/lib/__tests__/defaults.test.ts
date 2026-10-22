import { describe, expect, it } from "vitest";
import { fillDefaults } from "../defaults";

interface Shape {
  name: string;
  parentId: string | null;
  count: number;
}

const DEFAULTS: Shape = { name: "Untitled", parentId: null, count: 1 };

describe("fillDefaults", () => {
  it("returns the defaults for an empty patch", () => {
    expect(fillDefaults<Shape>({}, DEFAULTS)).toEqual(DEFAULTS);
  });

  it("takes a patched value over its default, including falsy non-null values", () => {
    expect(fillDefaults<Shape>({ name: "", count: 0 }, DEFAULTS)).toEqual({
      name: "",
      parentId: null,
      count: 0,
    });
  });

  it("falls back to the default when the patch holds null or undefined", () => {
    const patch = { name: undefined, count: null } as unknown as Partial<Shape>;
    expect(fillDefaults(patch, DEFAULTS)).toEqual(DEFAULTS);
  });

  it("drops keys the defaults don't name", () => {
    const patch = { name: "Kept", extra: true } as Partial<Shape>;
    expect(fillDefaults(patch, DEFAULTS)).toEqual({ ...DEFAULTS, name: "Kept" });
  });

  it("does not mutate the defaults", () => {
    fillDefaults<Shape>({ name: "Changed" }, DEFAULTS);
    expect(DEFAULTS.name).toBe("Untitled");
  });
});
