import type { Card } from "@vega/shared";
import { memo, useCallback, useMemo } from "react";
import { formatShortDate } from "@/core/lib/date";
import { CheckField, ContextMenu, cx, Icon } from "@/core/ui";
import { CardAttributeChip } from "./CardAttributeChip";
import { buildCardMenuItems, type CardRowActions } from "./card-row-actions";
import { useCardsVirtualizer } from "./useCardsVirtualizer";
import { WindowSlot } from "./WindowSlot";

const TAP_CELL = "inline-flex h-11 items-center";
// A row is two 44px tap lines plus its padding; wrapped chips grow it, and the row is measured.
const ESTIMATED_ROW_PX = 105;
const OVERSCAN_ROWS = 8;

const MobileRow = memo(function MobileRow({
  card,
  index,
  categories,
  isSelected,
  actions,
  measureRef,
}: {
  card: Card;
  index: number;
  categories: string[];
  isSelected: boolean;
  actions: CardRowActions;
  measureRef: (node: HTMLDivElement | null) => void;
}) {
  const isHidden = card.hiddenAt !== null;
  const menuItems = useMemo(
    () => buildCardMenuItems(card, actions, { isSelected }),
    [card, actions, isSelected],
  );

  return (
    <ContextMenu items={menuItems} longPress>
      <div
        ref={measureRef}
        data-card-row={card.id}
        data-index={index}
        className={cx(
          "flex items-start gap-2 px-2.5 py-2",
          index !== 0 && "border-border border-t",
          isHidden && "opacity-50",
        )}
      >
        <span className="shrink-0">
          <CheckField
            isSelected={isSelected}
            onChange={() => actions.onToggleSelect(card.id)}
            label={`Select ${card.title}`}
            isTouchTarget
          />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-h-[44px] items-baseline gap-2.5 pt-2.5">
            <button
              type="button"
              onClick={() => actions.onOpen(card)}
              className="min-w-0 flex-1 truncate text-left font-medium text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {card.title}
            </button>
            {isHidden && <span className="shrink-0 text-muted text-xs">Hidden</span>}
            <span className="shrink-0 text-muted text-xs tabular-nums">
              {formatShortDate(card.addedAt)}
            </span>
          </span>

          <span className="flex flex-wrap items-center gap-x-2 gap-y-0">
            <span className={TAP_CELL}>
              <CardAttributeChip
                attribute="type"
                card={card}
                categories={categories}
                actions={actions}
              />
            </span>
            <span className={TAP_CELL}>
              <CardAttributeChip
                attribute="category"
                card={card}
                categories={categories}
                actions={actions}
              />
            </span>
            <span className={TAP_CELL}>
              <CardAttributeChip
                attribute="learning"
                card={card}
                categories={categories}
                actions={actions}
              />
            </span>
          </span>
        </span>

        <button
          type="button"
          onClick={() => actions.onToggleHidden(card)}
          aria-label={isHidden ? `Restore ${card.title}` : `Hide ${card.title}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={isHidden ? "eye-off" : "eye"} size={16} />
        </button>
      </div>
    </ContextMenu>
  );
});

export function CardsMobileList({
  rows,
  categories,
  selectedIds,
  actions,
}: {
  rows: Card[];
  categories: string[];
  selectedIds: Set<string>;
  actions: CardRowActions;
}) {
  const estimateSize = useCallback(() => ESTIMATED_ROW_PX, []);
  const getItemKey = useCallback((index: number) => rows[index].id, [rows]);
  const { virtualizer, listRef, slots, spacers } = useCardsVirtualizer({
    listKey: "mobile",
    rows,
    estimateSize,
    overscan: OVERSCAN_ROWS,
    getItemKey,
  });

  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft">
      <div ref={listRef} style={{ paddingTop: spacers.before, paddingBottom: spacers.after }}>
        {slots.map(({ key, index, row: card, gapPx }) => (
          <WindowSlot key={key} gapPx={gapPx}>
            <MobileRow
              card={card}
              index={index}
              categories={categories}
              isSelected={selectedIds.has(card.id)}
              actions={actions}
              measureRef={virtualizer.measureElement}
            />
          </WindowSlot>
        ))}
      </div>
    </div>
  );
}
