import { cx } from "./cx";
import { Icon } from "./icons";

export interface ColumnSort<Column extends string> {
  column: Column;
  direction: "asc" | "desc";
}

export function toggleColumnSort<Column extends string>(
  current: ColumnSort<Column>,
  column: Column,
  defaultDesc: readonly Column[],
): ColumnSort<Column> {
  if (current.column === column)
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  return { column, direction: defaultDesc.includes(column) ? "desc" : "asc" };
}

export function SortHeader<Column extends string>({
  columns,
  sort,
  onSort,
  buttonClassName,
}: {
  columns: readonly { column: Column; label: string }[];
  sort: ColumnSort<Column>;
  onSort: (column: Column) => void;
  buttonClassName?: string;
}) {
  return (
    <>
      {columns.map(({ column, label }) => (
        <button
          key={column}
          type="button"
          onClick={() => onSort(column)}
          aria-pressed={sort.column === column}
          className={cx(
            "flex items-center gap-1 justify-self-start text-muted text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
            buttonClassName,
          )}
        >
          {label}
          {sort.column === column && (
            <Icon name={sort.direction === "asc" ? "chevU" : "chevD"} size={12} />
          )}
        </button>
      ))}
    </>
  );
}
