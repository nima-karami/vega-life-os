import type { FinanceColumnMapping } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  detectLayout,
  headerSignature,
  isMappingApplicable,
  resolveMapping,
} from "../import/layouts";

const RBC_HEADERS = [
  "Account Type",
  "Account Number",
  "Transaction Date",
  "Cheque Number",
  "Description 1",
  "Description 2",
  "CAD$",
];

const remembered: FinanceColumnMapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: null,
  debitColumn: "Debit",
  creditColumn: "Credit",
  dateFormat: "DD/MM/YYYY",
  debitsArePositive: true,
};

describe("headerSignature", () => {
  it("ignores case, padding and trailing empty columns", () => {
    expect(headerSignature([" Date ", "AMOUNT", ""])).toBe("date|amount");
  });

  it("collapses runs of whitespace inside a header", () => {
    expect(headerSignature(["Transaction   Date"])).toBe("transaction date");
  });
});

describe("detectLayout", () => {
  it("recognises the RBC export and carries an explicit date format and sign convention", () => {
    const layout = detectLayout(RBC_HEADERS);
    expect(layout?.id).toBe("rbc-export");
    expect(layout?.mapping.dateFormat).toBe("MM/DD/YYYY");
    expect(layout?.mapping.debitsArePositive).toBe(false);
  });

  it("recognises the same export with the USD column appended", () => {
    expect(detectLayout([...RBC_HEADERS, "USD$"])?.id).toBe("rbc-export-usd");
  });

  it("returns null rather than guessing at an unknown signature", () => {
    expect(detectLayout(["Date", "Description", "Amount"])).toBeNull();
  });
});

describe("resolveMapping", () => {
  it("prefers the account's remembered mapping", () => {
    const resolved = resolveMapping(["Date", "Description", "Debit", "Credit"], remembered);
    expect(resolved).toEqual({ mapping: remembered, layoutId: null });
  });

  it("falls back to the registry when the remembered mapping's columns are gone", () => {
    const resolved = resolveMapping(RBC_HEADERS, remembered);
    expect(resolved?.layoutId).toBe("rbc-export");
  });

  it("returns null when neither applies", () => {
    expect(resolveMapping(["Posted", "Merchant", "Value"], remembered)).toBeNull();
  });
});

describe("isMappingApplicable", () => {
  it("rejects a mapping naming no amount column at all", () => {
    const amountless = { ...remembered, debitColumn: null, creditColumn: null };
    expect(isMappingApplicable(amountless, ["Date", "Description"])).toBe(false);
  });

  it("matches header names case-insensitively", () => {
    expect(isMappingApplicable(remembered, ["date", "description", "debit", "credit"])).toBe(true);
  });
});
