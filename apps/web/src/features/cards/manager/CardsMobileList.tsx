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
import { FixedListPicker } from "./FixedListPicker";

const TAP_CELL = "inline-flex h-11 items-center";

function MobileRow({
  card,
  categories,
  isSelected,
  isFirst,
  actions,
}: {
  card: Card;
  categories: string[];
  isSelected: boolean;
  isFirst: boolean;
  actions: CardRowActions;
}) {
  const isHidden = card.hiddenAt !== null;

  return (
    <ContextMenu items={buildCardMenuItems(card, actions, { isSelected })} longPress>
      <div
        data-card-row={card.id}
        className={cx(
          "flex items-start gap-2 px-2.5 py-2",
          !isFirst && "border-border border-t",
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
              <AttributeChip
                label={CARD_TYPES[card.type].label}
                ariaLabel={`Type of ${card.title}`}
              >
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
            <span className={TAP_CELL}>
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
            <span className={TAP_CELL}>
              <AttributeChip
                label={describeCardLearning(card)}
                ariaLabel={`Learning of ${card.title}`}
              >
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
}

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
  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft">
      {rows.map((card, index) => (
        <MobileRow
          key={card.id}
          card={card}
          categories={categories}
          isFirst={index === 0}
          isSelected={selectedIds.has(card.id)}
          actions={actions}
        />
      ))}
    </div>
  );
}
