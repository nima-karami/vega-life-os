import type { ReactNode } from "react";

export interface FinanceRowItem {
  id: string;
  label: string;
  /** the figure or status shown at the end of the row */
  meta?: string;
  trailing?: ReactNode;
}

/** The list container the finance surfaces share, so a row reads the same on every page. */
export function FinanceRowList({ rows }: { rows: FinanceRowItem[] }) {
  return (
    <ul className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-surface">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="truncate text-sm text-foreground">{row.label}</span>
          <div className="flex shrink-0 items-center gap-3">
            {row.meta && <span className="text-sm text-muted tabular-nums">{row.meta}</span>}
            {row.trailing}
          </div>
        </li>
      ))}
    </ul>
  );
}
