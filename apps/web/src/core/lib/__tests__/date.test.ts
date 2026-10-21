import { afterEach, describe, expect, it } from "vitest";
import { localDayOf } from "../date";

describe("localDayOf", () => {
  const originalZone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalZone;
  });

  it("returns the local date for a UTC-behind zone, not the UTC date", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(localDayOf("2026-10-21T01:30:00.000Z")).toBe("2026-10-20");
  });

  it("matches the UTC date when the zone is UTC", () => {
    process.env.TZ = "UTC";
    expect(localDayOf("2026-10-21T01:30:00.000Z")).toBe("2026-10-21");
  });
});
