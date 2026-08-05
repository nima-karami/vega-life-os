import { describe, expect, it } from "vitest";
import { detectSeparator, parseDelimitedTable } from "../import/delimited";
import { viewTable } from "../import/table";

const BOM = "﻿";

const read = (text: string) => viewTable(parseDelimitedTable(text));

describe("parseDelimitedTable — dialect", () => {
  it("reads CRLF rows and keeps a quoted field's embedded comma", () => {
    const view = read('Date,Description,Amount\r\n2026-07-10,"LANTERN, ANYTOWN",-7.25\r\n');
    expect(view.headers).toEqual(["Date", "Description", "Amount"]);
    expect(view.rows).toEqual([{ cells: ["2026-07-10", "LANTERN, ANYTOWN", "-7.25"], line: 2 }]);
  });

  it("reads LF rows identically", () => {
    expect(read("Date,Amount\n2026-07-10,-7.25\n").rows).toEqual([
      { cells: ["2026-07-10", "-7.25"], line: 2 },
    ]);
  });

  it("strips a UTF-8 BOM so the first header still matches", () => {
    expect(read(`${BOM}Date,Amount\n2026-07-10,-7.25\n`).headers[0]).toBe("Date");
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    const view = read('Description\n"SHE SAID ""HI"" TWICE"\n');
    expect(view.rows[0].cells[0]).toBe('SHE SAID "HI" TWICE');
  });

  it("keeps a newline inside a quoted field and still numbers the next line correctly", () => {
    const view = read('Description,Amount\n"FIRST\nSECOND",-1.00\nLAST,-2.00\n');
    expect(view.rows[0].cells[0]).toBe("FIRST\nSECOND");
    expect(view.rows[1]).toEqual({ cells: ["LAST", "-2.00"], line: 4 });
  });

  it("reads a final row that has no trailing newline", () => {
    expect(read("Date,Amount\n2026-07-10,-7.25").rows).toHaveLength(1);
  });

  it("drops fully blank lines", () => {
    expect(read("Date,Amount\n\n2026-07-10,-7.25\n\n").rows).toHaveLength(1);
  });

  it("keeps an empty trailing cell", () => {
    const view = read("Date,Debit,Credit\n2026-07-10,7.25,\n");
    expect(view.rows[0].cells).toEqual(["2026-07-10", "7.25", ""]);
  });
});

describe("parseDelimitedTable — TSV", () => {
  it("detects tabs over commas when the header is tab separated", () => {
    expect(detectSeparator("Date\tDescription, Inc\tAmount\n")).toBe("\t");
  });

  it("splits a TSV without being told", () => {
    const view = read("Date\tDescription\tAmount\n2026-07-10\tLANTERN\t-7.25\n");
    expect(view.rows[0].cells).toEqual(["2026-07-10", "LANTERN", "-7.25"]);
  });

  it("defaults to commas for a plain CSV", () => {
    expect(detectSeparator("Date,Description,Amount\n")).toBe(",");
  });
});
