import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { isWorkbookFileName, readWorkbookTable } from "../import/workbook";

async function buildWorkbook(rows: unknown[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Statement");
  for (const row of rows) sheet.addRow(row);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("isWorkbookFileName", () => {
  it("recognises .xlsx whatever the case", () => {
    expect(isWorkbookFileName("bank_card_jul.XLSX")).toBe(true);
    expect(isWorkbookFileName("bank_card_jul.csv")).toBe(false);
  });
});

describe("readWorkbookTable", () => {
  it("reads the header row and the data rows with their sheet row numbers", async () => {
    const data = await buildWorkbook([
      ["Date", "Description", "Amount"],
      ["2026-07-10", "PANTRYCO", -38.40],
      ["2026-07-11", "LANTERN", -7.25],
    ]);
    const table = await readWorkbookTable(data);
    expect(table.headers).toEqual(["Date", "Description", "Amount"]);
    expect(table.rows).toEqual([
      { cells: ["2026-07-10", "PANTRYCO", "-38.40"], line: 2 },
      { cells: ["2026-07-11", "LANTERN", "-7.25"], line: 3 },
    ]);
  });

  it("renders a real date cell as an ISO date rather than a locale string", async () => {
    const data = await buildWorkbook([
      ["Date", "Amount"],
      [new Date(Date.UTC(2026, 6, 3)), -1],
    ]);
    const table = await readWorkbookTable(data);
    expect(table.rows[0].cells).toEqual(["2026-07-10", "-1"]);
  });

  it("keeps a float artefact out of the money parser", async () => {
    const data = await buildWorkbook([["Amount"], [0.1 + 0.2]]);
    const table = await readWorkbookTable(data);
    expect(table.rows[0].cells[0]).toBe("0.30");
  });

  it("returns an empty table for a workbook with no sheets", async () => {
    const workbook = new ExcelJS.Workbook();
    const data = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    expect(await readWorkbookTable(data)).toEqual({ headers: [], rows: [] });
  });
});
