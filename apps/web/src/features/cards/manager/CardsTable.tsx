import type { Card } from "@vega/shared";
import { CheckField, cx, Icon } from "@/core/ui";
import { CARD_SORT_COLUMNS, type CardSort, type CardSortColumn } from "../manager-query";
import { CardsTableRow } from "./CardsTableRow";
import { ColumnResizer } from "./ColumnResizer";
import type { CardRowActions } from "./card-row-actions";
import { CELL_CLASS, CENTER_CELL_CLASS } from "./cell-styles";
import {
  buildGridTemplate,
  type ColumnWidths,
  type ResizableColumn,
  tableWidth,
} from "./column-widths";

export function CardsTable({
  rows,
  categories,
  selectedIds,
  isAllVisibleSelected,
  sort,
  widths,
  onResize,
  onResizeCommit,
  onSort,
  onToggleVisible,
  actions,
}: {
  rows: Card[];
  categories: string[];
  selectedIds: Set<string>;
  isAllVisibleSelected: boolean;
  sort: CardSort;
  widths: ColumnWidths;
  onResize: (column: ResizableColumn, next: number) => void;
  onResizeCommit: () => void;
  onSort: (column: CardSortColumn) => void;
  onToggleVisible: () => void;
  actions: CardRowActions;
}) {
  const template = buildGridTemplate(widths);

  return (
    <div className="mt-4 overflow-x-auto">
      <div
        className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft"
        style={{ minWidth: tableWidth(widths) }}
      >
        <div
          className="grid h-9 border-border border-b bg-surface-secondary"
          style={{ gridTemplateColumns: template }}
        >
          <span className={CENTER_CELL_CLASS}>
            <CheckField
              isSelected={isAllVisibleSelected}
              onChange={onToggleVisible}
              label={"Select every card in view"}
            />
          </span>

          {CARD_SORT_COLUMNS.map(({ column, label }) => (
            <span key={column} className={cx(CELL_CLASS, "relative")}>
              <button
                type="button"
                onClick={() => onSort(column)}
                aria-pressed={sort.column === column}
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-muted text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="truncate">{label}</span>
                {sort.column === column && (
                  <Icon name={sort.direction === "asc" ? "chevU" : "chevD"} size={12} />
                )}
              </button>
              <ColumnResizer
                column={column}
                widths={widths}
                onResize={onResize}
                onResizeCommit={onResizeCommit}
              />
            </span>
          ))}

          <span className={CELL_CLASS} />
        </div>

        {rows.map((card, index) => (
          <CardsTableRow
            key={card.id}
            card={card}
            template={template}
            categories={categories}
            isFirst={index === 0}
            isSelected={selectedIds.has(card.id)}
            actions={actions}
          />
        ))}
      </div>
    </div>
  );
}
