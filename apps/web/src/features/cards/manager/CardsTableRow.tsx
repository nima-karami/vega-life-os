import type { Card } from "@vega/shared";
import { memo, useMemo } from "react";
import { formatShortDate } from "@/core/lib/date";
import { CheckField, ContextMenu, cx, Icon } from "@/core/ui";
import { CardAttributeChip } from "./CardAttributeChip";
import { buildCardMenuItems, type CardRowActions } from "./card-row-actions";
import { CELL_CLASS, CENTER_CELL_CLASS } from "./cell-styles";

export const CardsTableRow = memo(function CardsTableRow({
  card,
  index,
  template,
  categories,
  isSelected,
  actions,
}: {
  card: Card;
  index: number;
  template: string;
  categories: string[];
  isSelected: boolean;
  actions: CardRowActions;
}) {
  const isHidden = card.hiddenAt !== null;
  const menuItems = useMemo(
    () => buildCardMenuItems(card, actions, { isSelected }),
    [card, actions, isSelected],
  );

  return (
    <ContextMenu items={menuItems}>
      <div
        data-card-row={card.id}
        data-index={index}
        style={{ gridTemplateColumns: template }}
        className={cx(
          "grid h-11",
          index !== 0 && "border-border border-t",
          isSelected && "bg-accent/[0.06]",
          isHidden && "opacity-50",
        )}
      >
        <span className={CENTER_CELL_CLASS}>
          <CheckField
            isSelected={isSelected}
            onChange={() => actions.onToggleSelect(card.id)}
            label={`Select ${card.title}`}
          />
        </span>

        <span className={CELL_CLASS}>
          <button
            type="button"
            onClick={() => actions.onOpen(card)}
            className="min-w-0 truncate text-left text-foreground text-sm outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {card.title}
          </button>
          {isHidden && <span className="shrink-0 text-muted text-xs">Hidden</span>}
        </span>

        <span className={CELL_CLASS}>
          <CardAttributeChip
            attribute="type"
            card={card}
            categories={categories}
            actions={actions}
          />
        </span>

        <span className={CELL_CLASS}>
          <CardAttributeChip
            attribute="category"
            card={card}
            categories={categories}
            actions={actions}
          />
        </span>

        <span className={CELL_CLASS}>
          <CardAttributeChip
            attribute="learning"
            card={card}
            categories={categories}
            actions={actions}
          />
        </span>

        <span className={cx(CELL_CLASS, "text-muted text-xs tabular-nums")}>
          {formatShortDate(card.addedAt)}
        </span>

        <span className={CENTER_CELL_CLASS}>
          <button
            type="button"
            onClick={() => actions.onToggleHidden(card)}
            aria-label={isHidden ? `Restore ${card.title}` : `Hide ${card.title}`}
            className="rounded text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name={isHidden ? "eye-off" : "eye"} size={15} />
          </button>
        </span>
      </div>
    </ContextMenu>
  );
});
