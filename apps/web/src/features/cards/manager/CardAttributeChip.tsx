import { CARD_TYPES, type Card } from "@vega/shared";
import { CategoryCombobox } from "../CategoryCombobox";
import { describeCardLearning } from "../manager-query";
import { AttributeChip } from "./AttributeChip";
import {
  buildLearningOptions,
  buildLearningPatch,
  buildTypeOptions,
  type CardRowActions,
} from "./card-row-actions";
import { FixedListPicker } from "./FixedListPicker";

export type CardAttribute = "type" | "category" | "learning";

/** One editable attribute of a row — the table cell and the phone row share it. */
export function CardAttributeChip({
  attribute,
  card,
  categories,
  actions,
}: {
  attribute: CardAttribute;
  card: Card;
  categories: string[];
  actions: CardRowActions;
}) {
  if (attribute === "type") {
    return (
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
    );
  }

  if (attribute === "category") {
    return (
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
    );
  }

  return (
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
  );
}
