import { CARD_TYPES, type Card } from "@vega/shared";
import { formatShortDate } from "@/core/lib/date";
import { CheckField, ContextMenu, cx, Icon } from "@/core/ui";
import { CategoryCombobox } from "../CategoryCombobox";
import { describeCardLearning } from "../manager-query";
import { AttributeChip } from "./AttributeChip";
import {
  buildCardMenuItems,
  buildLearningOptions,
  buildLearningPatch,
  buildTypeOptions,
  type CardRowActions,
} from "./card-row-actions";
import { CELL_CLASS, CENTER_CELL_CLASS } from "./cell-styles";
import { FixedListPicker } from "./FixedListPicker";

export function CardsTableRow({
  card,
  template,
  categories,
  isSelected,
  isFirst,
  actions,
}: {
  card: Card;
  template: string;
  categories: string[];
  isSelected: boolean;
  isFirst: boolean;
  actions: CardRowActions;
}) {
  const isHidden = card.hiddenAt !== null;

  return (
    <ContextMenu items={buildCardMenuItems(card, actions, { isSelected })}>
      <div
        data-card-row={card.id}
        style={{ gridTemplateColumns: template }}
        className={cx(
          "grid h-11",
          !isFirst && "border-border border-t",
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
          <AttributeChip label={CARD_TYPES[card.type].label} ariaLabel={`Type of ${card.title}`}>
            {(close) => (
              <FixedListPicker
                options={buildTypeOptions()}
                selectedId={card.type}
                ariaLabel="Card type"
                onSelect={(id) => {
                  actions.onTypeChange(card, id as Card["type"]);
                  close();
                }}
              />
            )}
          </AttributeChip>
        </span>

        <span className={CELL_CLASS}>
          <AttributeChip
            label={card.category === "" ? "No category" : card.category}
            ariaLabel={`Category of ${card.title}`}
          >
            {(close) => (
              <CategoryCombobox
                categories={categories}
                selected={card.category}
                ariaLabel="Filter categories"
                onSelect={(category) => {
                  actions.onPatch(card.id, { category });
                  close();
                }}
              />
            )}
          </AttributeChip>
        </span>

        <span className={CELL_CLASS}>
          <AttributeChip label={describeCardLearning(card)} ariaLabel={`Learning of ${card.title}`}>
            {(close) => (
              <FixedListPicker
                options={buildLearningOptions(card)}
                selectedId={card.box === null ? "not-learning" : "learning"}
                ariaLabel="Learning state"
                onSelect={(id) => {
                  actions.onPatch(card.id, buildLearningPatch(id === "learning"));
                  close();
                }}
              />
            )}
          </AttributeChip>
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
}
