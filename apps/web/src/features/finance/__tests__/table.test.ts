import type { FinanceColumnMapping } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { parseDelimitedTable } from "../import/delimited";
import { resolveStatementView } from "../import/resolve";
import { buildTableView, hasHeaderRow } from "../import/table";

const HEADERED = "Date,Description,Amount\n07/10/2026,PANTRYCO,-38.40\n08/03/2026,LANTERN,-7.25\n";
const HEADERLESS = "07/10/2026,PANTRYCO,-38.40\n08/03/2026,LANTERN,-7.25\n";

const positional: FinanceColumnMapping = {
  dateColumn: "Column 1",
  descriptionColumn: "Column 2",
  amountColumn: "Column 3",
  debitColumn: null,
  creditColumn: null,
  dateFormat: "DD/MM/YYYY",
  debitsArePositive: false,
  hasHeaderRow: false,
};

describe("hasHeaderRow", () => {
  it("treats a first record carrying both a date and an amount as data", () => {
    expect(parseDelimitedTable(HEADERLESS).hasHeaderRow).toBe(false);
  });

  it("treats a first record of column names as headers", () => {
    expect(parseDelimitedTable(HEADERED).hasHeaderRow).toBe(true);
  });

  it("does not mistake the RBC header row for data", () => {
    const rbc = "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,CAD$\n";
    expect(parseDelimitedTable(rbc).hasHeaderRow).toBe(true);
  });

  it("assumes a header row for an empty file", () => {
    expect(hasHeaderRow([])).toBe(true);
  });
});

describe("buildTableView", () => {
  it("splits headers off a headered table", () => {
    const view = buildTableView(parseDelimitedTable(HEADERED));
    expect(view.headers).toEqual(["Date", "Description", "Amount"]);
    expect(view.rows).toHaveLength(2);
  });

  it("keeps every record and labels the columns positionally when headerless", () => {
    const view = buildTableView(parseDelimitedTable(HEADERLESS));
    expect(view.headers).toEqual(["Column 1", "Column 2", "Column 3"]);
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0].line).toBe(1);
  });

  it("lets a remembered mapping override the heuristic", () => {
    const view = buildTableView(parseDelimitedTable(HEADERED), false);
    expect(view.headers).toEqual(["Column 1", "Column 2", "Column 3"]);
    expect(view.rows).toHaveLength(3);
  });
});

const named: FinanceColumnMapping = {
  ...positional,
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: "Amount",
  hasHeaderRow: true,
};

describe("resolveStatementView", () => {
  it("applies a remembered headerless mapping", () => {
    const resolved = resolveStatementView(parseDelimitedTable(HEADERLESS), positional);
    expect(resolved.resolved?.mapping).toEqual(positional);
    expect(resolved.view.rows).toHaveLength(2);
  });

  it("reports positional labels for an unmapped headerless file", () => {
    const resolved = resolveStatementView(parseDelimitedTable(HEADERLESS), null);
    expect(resolved.resolved).toBeNull();
    expect(resolved.view.headers).toEqual(["Column 1", "Column 2", "Column 3"]);
  });

  it("will not let a remembered header row swallow a real first transaction", () => {
    const resolved = resolveStatementView(parseDelimitedTable(HEADERLESS), named);
    expect(resolved.view.hasHeaderRow).toBe(false);
    expect(resolved.view.rows).toHaveLength(2);
    expect(resolved.resolved).toBeNull();
  });

  it("falls back to the header-keyed registry when the remembered mapping does not fit", () => {
    const rbc = [
      "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$",
      "Chequing,00001,07/10/2026,,PANTRYCO,,-38.40",
      "",
    ].join("\n");
    const resolved = resolveStatementView(parseDelimitedTable(rbc), named);
    expect(resolved.resolved?.layoutId).toBe("rbc-export");
    expect(resolved.view.hasHeaderRow).toBe(true);
  });
});
