import { describe, expect, it } from "vitest";
import { shouldUpdateTimeZone } from "../timezone";

describe("shouldUpdateTimeZone", () => {
  it("is true when a known synced zone differs from the browser", () => {
    expect(shouldUpdateTimeZone("America/New_York", "Europe/Berlin")).toBe(true);
  });

  it("is false when the zones match", () => {
    expect(shouldUpdateTimeZone("Europe/Berlin", "Europe/Berlin")).toBe(false);
  });

  it("is true for a legacy account with no synced zone (adopt the browser zone)", () => {
    expect(shouldUpdateTimeZone(null, "Europe/Berlin")).toBe(true);
    expect(shouldUpdateTimeZone(undefined, "Europe/Berlin")).toBe(true);
  });
});
