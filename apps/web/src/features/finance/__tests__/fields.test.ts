import { describe, expect, it } from "vitest";
import { formatDateLabel, parseAmountCents, parseStatementDate } from "../import/fields";

describe("parseStatementDate — the format is never inferred", () => {
  it("reads the same ambiguous cell differently under each convention", () => {
    expect(parseStatementDate("07/10/2026", "DD/MM/YYYY")).toBe("2026-10-07");
    expect(parseStatementDate("07/10/2026", "MM/DD/YYYY")).toBe("2026-07-10");
  });

  it("reads an ISO cell", () => {
    expect(parseStatementDate("2026-07-10", "YYYY-MM-DD")).toBe("2026-07-10");
  });

  it("accepts an ISO cell under any declared format, because its order cannot be misread", () => {
    expect(parseStatementDate("2026-07-10", "MM/DD/YYYY")).toBe("2026-07-10");
  });

  it("rejects a slashed cell when the account declares ISO", () => {
    expect(parseStatementDate("07/10/2026", "YYYY-MM-DD")).toBeNull();
  });

  it("rejects an impossible month", () => {
    expect(parseStatementDate("13/07/2026", "MM/DD/YYYY")).toBeNull();
  });

  it("rejects a day past the end of the month", () => {
    expect(parseStatementDate("2026-02-30", "YYYY-MM-DD")).toBeNull();
    expect(parseStatementDate("29/02/2026", "DD/MM/YYYY")).toBeNull();
  });

  it("accepts a leap day", () => {
    expect(parseStatementDate("29/02/2024", "DD/MM/YYYY")).toBe("2024-02-29");
  });

  it("pads single-digit day and month cells", () => {
    expect(parseStatementDate("10/7/2026", "DD/MM/YYYY")).toBe("2026-07-10");
  });

  it("rejects a two-digit year rather than assuming a century", () => {
    expect(parseStatementDate("10/07/26", "DD/MM/YYYY")).toBeNull();
  });
});

describe("formatDateLabel", () => {
  it("spells the month out for the worked example", () => {
    expect(formatDateLabel("2026-07-10")).toBe("10 July 2026");
  });
});

describe("parseAmountCents — integer cents only", () => {
  it("reads a signed decimal", () => {
    expect(parseAmountCents("-38.40")).toBe(-3840);
    expect(parseAmountCents("38.40")).toBe(3840);
  });

  it("reads thousands separators and a currency symbol", () => {
    expect(parseAmountCents("$1,234.56")).toBe(123456);
  });

  it("reads an accounting-style bracketed debit as negative", () => {
    expect(parseAmountCents("(38.40)")).toBe(-3840);
  });

  it("reads a unicode minus", () => {
    expect(parseAmountCents("−7.00")).toBe(-700);
  });

  it("pads a single decimal place", () => {
    expect(parseAmountCents("1.5")).toBe(150);
  });

  it("reads a whole number", () => {
    expect(parseAmountCents("42")).toBe(4200);
  });

  it("rejects a blank or unreadable cell", () => {
    expect(parseAmountCents("")).toBeNull();
    expect(parseAmountCents("n/a")).toBeNull();
    expect(parseAmountCents("1.234")).toBeNull();
  });
});
