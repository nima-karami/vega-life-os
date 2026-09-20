import { describe, expect, it } from "vitest";
import { resolveDisplayZone, shouldUpdateTimeZone } from "../timezone";

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

describe("resolveDisplayZone", () => {
  it("falls back to the browser zone when there is no account zone", () => {
    expect(resolveDisplayZone(null, "Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(resolveDisplayZone(undefined, "Asia/Tokyo")).toBe("Asia/Tokyo");
  });

  it("keeps the account zone when it matches the browser", () => {
    expect(resolveDisplayZone("America/New_York", "America/New_York")).toBe("America/New_York");
  });

  it("lets the account zone win over the browser's", () => {
    expect(resolveDisplayZone("America/New_York", "Asia/Tokyo")).toBe("America/New_York");
  });

  it("falls back rather than throwing on an unusable account zone", () => {
    expect(() => resolveDisplayZone("Mars/Olympus", "Asia/Tokyo")).not.toThrow();
    expect(resolveDisplayZone("Mars/Olympus", "Asia/Tokyo")).toBe("Asia/Tokyo");
  });
});
