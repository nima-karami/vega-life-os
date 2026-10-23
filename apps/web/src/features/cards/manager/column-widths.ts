import { useCallback, useRef, useState } from "react";

/** The five draggable columns, in table order. The checkbox and eye rails are fixed. */
const RESIZABLE_COLUMNS = ["title", "type", "category", "learning", "addedAt"] as const;
export type ResizableColumn = (typeof RESIZABLE_COLUMNS)[number];

export const RAIL_PX = 44;
export const MIN_COLUMN_PX = 72;

const STORAGE_KEY = "vega.cardsColumnWidths";

export const DEFAULT_COLUMN_WIDTHS: Record<ResizableColumn, number> = {
  title: 260,
  type: 136,
  category: 150,
  learning: 164,
  addedAt: 96,
};

export type ColumnWidths = Record<ResizableColumn, number>;

function resolveColumnWidth(stored: unknown, fallback: number): number {
  if (typeof stored !== "number" || !Number.isFinite(stored) || stored <= 0) return fallback;
  return Math.max(MIN_COLUMN_PX, Math.round(stored));
}

export function readStoredColumnWidths(): ColumnWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? {} : JSON.parse(raw);
    const source: Record<string, unknown> =
      typeof parsed === "object" && parsed !== null ? parsed : {};
    return RESIZABLE_COLUMNS.reduce((widths, column) => {
      widths[column] = resolveColumnWidth(source[column], DEFAULT_COLUMN_WIDTHS[column]);
      return widths;
    }, {} as ColumnWidths);
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

export function writeStoredColumnWidths(widths: ColumnWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    /* ignore */
  }
}

/** One template for the header row and every body row, so their dividers cannot drift apart. */
export function buildGridTemplate(widths: ColumnWidths): string {
  const middle = RESIZABLE_COLUMNS.map((column) =>
    column === "title" ? `minmax(${widths[column]}px, 1fr)` : `${widths[column]}px`,
  ).join(" ");
  return `${RAIL_PX}px ${middle} ${RAIL_PX}px`;
}

export const tableWidth = (widths: ColumnWidths): number =>
  RAIL_PX * 2 + RESIZABLE_COLUMNS.reduce((sum, column) => sum + widths[column], 0);

export function useColumnWidths() {
  const [widths, setWidths] = useState<ColumnWidths>(readStoredColumnWidths);
  // Ahead of state: a keyboard step resizes and commits in one handler, before any re-render.
  const latestWidths = useRef(widths);

  const resize = useCallback((column: ResizableColumn, next: number) => {
    const updated = {
      ...latestWidths.current,
      [column]: Math.max(MIN_COLUMN_PX, Math.round(next)),
    };
    latestWidths.current = updated;
    setWidths(updated);
  }, []);

  const commit = useCallback(() => writeStoredColumnWidths(latestWidths.current), []);

  return { widths, resize, commit };
}
