import { describe, expect, it } from "vitest";
import { shouldUpdateTimeZone } from "../timezone";

describe("shouldUpdateTimeZone", () => {
  it("is true when a known synced zone differs from the browser", () => {
    expect(shouldUpdateTimeZone("America/New_York", "Europe/Berlin")).toBe(true);
  });

  it("is false when the zones match", () => {
    expect(shouldUpdateTimeZone("Europe/Berlin", "Europe/Berlin")).toBe(false);
  });

  it("is false when the account has no synced zone yet", () => {
    expect(shouldUpdateTimeZone(null, "Europe/Berlin")).toBe(false);
    expect(shouldUpdateTimeZone(undefined, "Europe/Berlin")).toBe(false);
  });
});
