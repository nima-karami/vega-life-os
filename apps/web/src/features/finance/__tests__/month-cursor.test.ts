import { describe, expect, it } from "vitest";
import {
  formatMonthLabel,
  isMonthKey,
  monthOfISO,
  shiftMonthKey,
  toMonthKey,
} from "../month-cursor";

describe("the month key", () => {
  it("accepts a real month and rejects anything else", () => {
    expect(isMonthKey("2026-08")).toBe(true);
    expect(isMonthKey("2026-01")).toBe(true);
    expect(isMonthKey("2026-12")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-8")).toBe(false);
    expect(isMonthKey("2026-08-04")).toBe(false);
    expect(isMonthKey("august")).toBe(false);
    expect(isMonthKey("")).toBe(false);
  });

  it("reads the month a moment falls in, in local time", () => {
    expect(toMonthKey(new Date(2026, 7, 4, 12))).toBe("2026-08");
    expect(toMonthKey(new Date(2026, 0, 1, 0, 30))).toBe("2026-01");
  });

  // A row's date is already `yyyy-MM-dd`; parsing it per row per render costs ~100× the slice.
  it("takes the month off an ISO date without parsing it", () => {
    expect(monthOfISO("2026-08-04")).toBe("2026-08");
    expect(monthOfISO("2025-12-31")).toBe("2025-12");
    expect(monthOfISO("2026-01-01T09:30:00.000Z")).toBe("2026-01");
    expect(isMonthKey(monthOfISO("2026-08-04"))).toBe(true);
  });

  it("throws on a date it can't read, so a card fails loudly instead of dropping the row", () => {
    expect(() => monthOfISO("not-a-date")).toThrow(RangeError);
    expect(() => monthOfISO("2026-13-01")).toThrow(RangeError);
    expect(() => monthOfISO("2026-08")).toThrow(RangeError);
  });
});

describe("stepping the cursor", () => {
  it("walks forwards and backwards a month at a time", () => {
    expect(shiftMonthKey("2026-08", -1)).toBe("2026-07");
    expect(shiftMonthKey("2026-08", 1)).toBe("2026-09");
    expect(shiftMonthKey("2026-08", -3)).toBe("2026-05");
  });

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("names the month the way the header shows it", () => {
    expect(formatMonthLabel("2026-08")).toBe("August 2026");
    expect(formatMonthLabel("2025-12")).toBe("December 2025");
  });
});
