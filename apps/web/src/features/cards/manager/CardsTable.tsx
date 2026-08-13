import { Checkbox } from "@heroui/react";
import type { Card } from "@vega/shared";
import { cx, Icon, SortHeader } from "@/core/ui";
import { CARD_SORT_COLUMNS, type CardSort, type CardSortColumn } from "../manager-query";
import { CardsTableRow } from "./CardsTableRow";
import type { CardRowActions } from "./card-row-actions";
import { CARDS_GRID, CARDS_TABLE_MIN_WIDTH, CELL_CLASS, CENTER_CELL_CLASS } from "./cell-styles";

export function CardsTable({
  rows,
  categories,
  selectedIds,
  isAllVisibleSelected,
  sort,
  onSort,
  onToggleVisible,
  actions,
}: {
  rows: Card[];
  categories: string[];
  selectedIds: Set<string>;
  isAllVisibleSelected: boolean;
  sort: CardSort;
  onSort: (column: CardSortColumn) => void;
  onToggleVisible: () => void;
  actions: CardRowActions;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <div
        className={cx(
          "overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft",
          CARDS_TABLE_MIN_WIDTH,
        )}
      >
        <div className={cx("grid h-9 border-border border-b bg-surface-secondary", CARDS_GRID)}>
          <span className={CENTER_CELL_CLASS}>
            <Checkbox
              isSelected={isAllVisibleSelected}
              onChange={onToggleVisible}
              aria-label="Select every card in view"
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator>
                    <Icon name="check" size={12} />
                  </Checkbox.Indicator>
                </Checkbox.Control>
              </Checkbox.Content>
            </Checkbox>
          </span>
          <SortHeader
            columns={CARD_SORT_COLUMNS}
            sort={sort}
            onSort={onSort}
            buttonClassName={CELL_CLASS}
          />
          <span className={CELL_CLASS} />
        </div>

        {rows.map((card, index) => (
          <CardsTableRow
            key={card.id}
            card={card}
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
