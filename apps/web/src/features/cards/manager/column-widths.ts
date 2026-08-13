import { useCallback, useState } from "react";

/** The five draggable columns, in table order. The checkbox and eye rails are fixed. */
export const RESIZABLE_COLUMNS = ["title", "type", "category", "learning", "addedAt"] as const;
export type ResizableColumn = (typeof RESIZABLE_COLUMNS)[number];

export const RAIL_PX = 44;
const MIN_COLUMN_PX = 72;

export const DEFAULT_COLUMN_WIDTHS: Record<ResizableColumn, number> = {
  title: 320,
  type: 148,
  category: 152,
  learning: 160,
  addedAt: 92,
};

export type ColumnWidths = Record<ResizableColumn, number>;

/** One template for the header row and every body row, so their dividers cannot drift apart. */
export function buildGridTemplate(widths: ColumnWidths): string {
  const middle = RESIZABLE_COLUMNS.map((column) => `${widths[column]}px`).join(" ");
  return `${RAIL_PX}px ${middle} ${RAIL_PX}px`;
}

export const tableWidth = (widths: ColumnWidths): number =>
  RAIL_PX * 2 + RESIZABLE_COLUMNS.reduce((sum, column) => sum + widths[column], 0);

/** Session-only by design: a drag is a glance-adjustment, not a preference worth syncing. */
export function useColumnWidths() {
  const [widths, setWidths] = useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);

  const resize = useCallback((column: ResizableColumn, next: number) => {
    setWidths((current) => ({ ...current, [column]: Math.max(MIN_COLUMN_PX, Math.round(next)) }));
  }, []);

  return { widths, resize };
}
