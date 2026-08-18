import type { CardTypeId, SlotId } from "@vega/shared";
import { type ReactNode, useState } from "react";
import { Icon, Popover } from "@/core/ui";
import { CategoryCombobox } from "../CategoryCombobox";
import { PICKER_PANEL_CLASS } from "../manager/cell-styles";
import { CardSlotField } from "./CardSlotField";
import { type CardDraft, readDraftSlot } from "./card-draft";
import { listCardPageFields } from "./card-fields";
import {
  FIELD_CONTROL_CLASS,
  FIELD_GROUP_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_SELECT_CLASS,
} from "./field-classes";
import { TypeControl } from "./TypeControl";

function CategoryField({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: string[];
  onChange: (next: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      align="start"
      triggerLabel="Category"
      triggerClassName={FIELD_SELECT_CLASS}
      className="p-[5px]"
      triggerContent={
        <>
          <span className="min-w-0 flex-1 truncate">{value === "" ? "Uncategorised" : value}</span>
          <Icon name="chevD" size={15} className="shrink-0 text-muted" />
        </>
      }
    >
      <div className={PICKER_PANEL_CLASS}>
        <CategoryCombobox
          categories={categories}
          selected={value}
          ariaLabel="Filter categories"
          onSelect={(next) => {
            setIsOpen(false);
            onChange(next);
          }}
        />
      </div>
    </Popover>
  );
}

export interface CardFieldStackProps {
  values: CardDraft;
  categories: string[];
  review: ReactNode;
  onTypeChange: (next: CardTypeId) => void;
  onSlotChange: (slot: SlotId, value: string | string[]) => void;
  onCategoryChange: (next: string) => void;
}

/** Type, Review and Category are the invariant head; everything below is generated. */
export function CardFieldStack({
  values,
  categories,
  review,
  onTypeChange,
  onSlotChange,
  onCategoryChange,
}: CardFieldStackProps) {
  return (
    <div>
      <div className={FIELD_GROUP_CLASS}>
        <span className={FIELD_LABEL_CLASS}>Type</span>
        <div className={FIELD_CONTROL_CLASS}>
          <TypeControl value={values.type} onChange={onTypeChange} />
        </div>
      </div>

      {review !== null && (
        <div className={FIELD_GROUP_CLASS}>
          <span className={FIELD_LABEL_CLASS}>Review</span>
          <div className={FIELD_CONTROL_CLASS}>{review}</div>
        </div>
      )}

      <div className={FIELD_GROUP_CLASS}>
        <span className={FIELD_LABEL_CLASS}>Category</span>
        <div className={FIELD_CONTROL_CLASS}>
          <CategoryField
            value={values.category}
            categories={categories}
            onChange={onCategoryChange}
          />
        </div>
      </div>

      {listCardPageFields(values.type).map((field) => (
        <CardSlotField
          key={field.slot}
          field={field}
          value={readDraftSlot(values, field.slot)}
          onChange={onSlotChange}
        />
      ))}
    </div>
  );
}
