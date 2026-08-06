import { hasHeaderRow } from "./table";
import type { TableData, TableRow } from "./types";

export type DelimitedSeparator = "," | "\t";

const BOM = "﻿";

const stripBom = (text: string) => (text.startsWith(BOM) ? text.slice(BOM.length) : text);

/** Tabs vs commas on the first physical line, ignoring anything inside quotes. */
export function detectSeparator(text: string): DelimitedSeparator {
  let tabs = 0;
  let commas = 0;
  let inQuotes = false;
  for (const char of stripBom(text)) {
    if (char === '"') inQuotes = !inQuotes;
    else if (inQuotes) continue;
    else if (char === "\n") break;
    else if (char === "\t") tabs += 1;
    else if (char === ",") commas += 1;
  }
  return tabs > commas ? "\t" : ",";
}

interface ScanState {
  records: TableRow[];
  cells: string[];
  field: string;
  inQuotes: boolean;
  line: number;
  startLine: number;
}

function closeField(scan: ScanState) {
  scan.cells.push(scan.field.trim());
  scan.field = "";
}

function closeRecord(scan: ScanState) {
  closeField(scan);
  if (scan.cells.some((cell) => cell !== "")) {
    scan.records.push({ cells: scan.cells, line: scan.startLine });
  }
  scan.cells = [];
  scan.startLine = scan.line;
}

/** Consumes one character inside a quoted field; returns how many characters it used. */
function readQuoted(scan: ScanState, char: string, next: string | undefined): number {
  if (char === '"' && next === '"') {
    scan.field += '"';
    return 2;
  }
  if (char === '"') {
    scan.inQuotes = false;
    return 1;
  }
  if (char === "\n") scan.line += 1;
  scan.field += char;
  return 1;
}

function readPlain(scan: ScanState, char: string, separator: DelimitedSeparator) {
  if (char === '"' && scan.field === "") scan.inQuotes = true;
  else if (char === separator) closeField(scan);
  else if (char === "\n") {
    scan.line += 1;
    closeRecord(scan);
  } else if (char !== "\r") scan.field += char;
}

/** RFC 4180: quoted fields may hold the separator, newlines, and `""`-escaped quotes. */
function readRecords(text: string, separator: DelimitedSeparator): TableRow[] {
  const source = stripBom(text);
  const scan: ScanState = {
    records: [],
    cells: [],
    field: "",
    inQuotes: false,
    line: 1,
    startLine: 1,
  };
  let index = 0;
  while (index < source.length) {
    if (scan.inQuotes) index += readQuoted(scan, source[index], source[index + 1]);
    else {
      readPlain(scan, source[index], separator);
      index += 1;
    }
  }
  if (scan.field !== "" || scan.cells.length > 0) closeRecord(scan);
  return scan.records;
}

export function parseDelimitedTable(text: string, separator?: DelimitedSeparator): TableData {
  const records = readRecords(text, separator ?? detectSeparator(text));
  return { records, hasHeaderRow: hasHeaderRow(records) };
}
