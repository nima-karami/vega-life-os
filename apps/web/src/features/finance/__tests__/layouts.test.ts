import type { FinanceColumnMapping } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildHeaderSignature, detectLayout, isMappingApplicable } from "../import/layouts";

const RBC_HEADERS = [
  "Account Type",
  "Account Number",
  "Transaction Date",
  "Cheque Number",
  "Description 1",
  "Description 2",
  "CAD$",
];

const paired: FinanceColumnMapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: null,
  debitColumn: "Debit",
  creditColumn: "Credit",
  dateFormat: "DD/MM/YYYY",
  debitsArePositive: true,
  hasHeaderRow: true,
};

describe("buildHeaderSignature", () => {
  it("ignores case, padding and trailing empty columns", () => {
    expect(buildHeaderSignature([" Date ", "AMOUNT", ""])).toBe("date|amount");
  });

  it("collapses runs of whitespace inside a header", () => {
    expect(buildHeaderSignature(["Transaction   Date"])).toBe("transaction date");
  });
});

describe("detectLayout", () => {
  it("recognises the RBC export and carries an explicit date format and sign convention", () => {
    const layout = detectLayout(RBC_HEADERS);
    expect(layout?.id).toBe("rbc-export");
    expect(layout?.mapping.dateFormat).toBe("MM/DD/YYYY");
    expect(layout?.mapping.debitsArePositive).toBe(false);
    expect(layout?.mapping.hasHeaderRow).toBe(true);
  });

  it("recognises the same export with the USD column appended", () => {
    expect(detectLayout([...RBC_HEADERS, "USD$"])?.id).toBe("rbc-export-usd");
  });

  it("returns null rather than guessing at an unknown signature", () => {
    expect(detectLayout(["Date", "Description", "Amount"])).toBeNull();
  });
});

describe("isMappingApplicable", () => {
  it("accepts a mapping whose debit/credit pair is present", () => {
    expect(isMappingApplicable(paired, ["Date", "Description", "Debit", "Credit"])).toBe(true);
  });

  it("rejects a mapping naming no amount column at all", () => {
    const amountless = { ...paired, debitColumn: null, creditColumn: null };
    expect(isMappingApplicable(amountless, ["Date", "Description"])).toBe(false);
  });

  it("matches header names case-insensitively", () => {
    expect(isMappingApplicable(paired, ["date", "description", "debit", "credit"])).toBe(true);
  });

  it("rejects a mapping whose columns are missing from the file", () => {
    expect(isMappingApplicable(paired, RBC_HEADERS)).toBe(false);
  });
});
