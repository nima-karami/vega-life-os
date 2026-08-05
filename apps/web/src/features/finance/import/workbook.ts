import { format } from "date-fns";
import type { CellValue, Workbook } from "exceljs";
import { detectHasHeaderRow } from "./table";
import type { TableData, TableRow } from "./types";

type WorkbookInput = Parameters<Workbook["xlsx"]["load"]>[0];

export const isWorkbookFileName = (name: string) => /\.xlsx$/i.test(name.trim());

const isRichText = (value: object): value is { richText: { text: string }[] } =>
  "richText" in value && Array.isArray((value as { richText: unknown }).richText);

const isFormula = (value: object): value is { result?: CellValue } => "result" in value;

const isHyperlink = (value: object): value is { text: string } => "text" in value;

/** Numbers become plain decimal text so the float never reaches the money parser. */
const numberToText = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

function toCellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  if (typeof value === "number") return numberToText(value);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (isRichText(value)) return value.richText.map((run) => run.text).join("");
  if (isFormula(value)) return toCellText(value.result ?? null);
  if (isHyperlink(value)) return value.text;
  return String(value);
}

/** First worksheet only — bank exports never carry a second sheet worth importing. */
export async function readWorkbookTable(data: ArrayBuffer | Uint8Array): Promise<TableData> {
  const { Workbook: WorkbookCtor } = await import("exceljs");
  const workbook = new WorkbookCtor();
  await workbook.xlsx.load(data as unknown as WorkbookInput);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { records: [], hasHeaderRow: true };

  const columnCount = sheet.columnCount;
  const records: TableRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = Array.from({ length: columnCount }, (_, index) =>
      toCellText(row.getCell(index + 1).value).trim(),
    );
    if (cells.some((cell) => cell !== "")) records.push({ cells, line: rowNumber });
  });

  return { records, hasHeaderRow: detectHasHeaderRow(records) };
}
