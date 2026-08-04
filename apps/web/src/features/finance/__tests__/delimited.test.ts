import { describe, expect, it } from "vitest";
import { detectSeparator, parseDelimitedTable } from "../import/delimited";

const BOM = "﻿";

describe("parseDelimitedTable — dialect", () => {
  it("reads CRLF rows and keeps a quoted field's embedded comma", () => {
    const text = 'Date,Description,Amount\r\n2026-07-10,"LANTERN, ANYTOWN",-7.25\r\n';
    const table = parseDelimitedTable(text);
    expect(table.headers).toEqual(["Date", "Description", "Amount"]);
    expect(table.rows).toEqual([{ cells: ["2026-07-10", "LANTERN, ANYTOWN", "-7.25"], line: 2 }]);
  });

  it("reads LF rows identically", () => {
    const table = parseDelimitedTable("Date,Amount\n2026-07-10,-7.25\n");
    expect(table.rows).toEqual([{ cells: ["2026-07-10", "-7.25"], line: 2 }]);
  });

  it("strips a UTF-8 BOM so the first header still matches", () => {
    const table = parseDelimitedTable(`${BOM}Date,Amount\n2026-07-10,-7.25\n`);
    expect(table.headers[0]).toBe("Date");
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    const table = parseDelimitedTable('Description\n"SHE SAID ""HI"" TWICE"\n');
    expect(table.rows[0].cells[0]).toBe('SHE SAID "HI" TWICE');
  });

  it("keeps a newline inside a quoted field and still numbers the next line correctly", () => {
    const table = parseDelimitedTable('Description,Amount\n"FIRST\nSECOND",-1.00\nLAST,-2.00\n');
    expect(table.rows[0].cells[0]).toBe("FIRST\nSECOND");
    expect(table.rows[1]).toEqual({ cells: ["LAST", "-2.00"], line: 4 });
  });

  it("reads a final row that has no trailing newline", () => {
    const table = parseDelimitedTable("Date,Amount\n2026-07-10,-7.25");
    expect(table.rows).toHaveLength(1);
  });

  it("drops fully blank lines", () => {
    const table = parseDelimitedTable("Date,Amount\n\n2026-07-10,-7.25\n\n");
    expect(table.rows).toHaveLength(1);
  });

  it("keeps an empty trailing cell", () => {
    const table = parseDelimitedTable("Date,Debit,Credit\n2026-07-10,7.25,\n");
    expect(table.rows[0].cells).toEqual(["2026-07-10", "7.25", ""]);
  });
});

describe("parseDelimitedTable — TSV", () => {
  it("detects tabs over commas when the header is tab separated", () => {
    expect(detectSeparator("Date\tDescription, Inc\tAmount\n")).toBe("\t");
  });

  it("splits a TSV without being told", () => {
    const table = parseDelimitedTable("Date\tDescription\tAmount\n2026-07-10\tLANTERN\t-7.25\n");
    expect(table.rows[0].cells).toEqual(["2026-07-10", "LANTERN", "-7.25"]);
  });

  it("defaults to commas for a plain CSV", () => {
    expect(detectSeparator("Date,Description,Amount\n")).toBe(",");
  });
});
