import type { SlotId } from "@vega/shared";
import { CharCounter } from "../CharCounter";
import type { CardPageField } from "./card-fields";
import { slotPlaceholder } from "./card-fields";
import { ExamplesField } from "./ExamplesField";
import {
  FIELD_CONTROL_CLASS,
  FIELD_GROUP_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_MONO_CLASS,
  FIELD_TALL_CLASS,
  FIELD_TEXT_CLASS,
} from "./field-classes";
import { SynonymsField } from "./SynonymsField";

export function CardSlotField({
  field,
  value,
  onChange,
}: {
  field: CardPageField;
  value: string | string[];
  onChange: (slot: SlotId, next: string | string[]) => void;
}) {
  const { slot, def, control } = field;
  const list = Array.isArray(value) ? value : [];
  const text = Array.isArray(value) ? "" : value;

  return (
    <div className={FIELD_GROUP_CLASS}>
      <span className="flex items-center gap-2">
        <span className={FIELD_LABEL_CLASS}>{def.label}</span>
        {control !== "rows" && control !== "chips" && (
          <CharCounter length={text.length} max={def.max} />
        )}
      </span>
      <div className={FIELD_CONTROL_CLASS}>
        {control === "rows" && (
          <ExamplesField def={def} values={list} onChange={(next) => onChange(slot, next)} />
        )}
        {control === "chips" && (
          <SynonymsField def={def} values={list} onChange={(next) => onChange(slot, next)} />
        )}
        {control === "textarea" && (
          <textarea
            aria-label={def.label}
            placeholder={slotPlaceholder(def)}
            value={text}
            maxLength={def.max}
            onChange={(event) => onChange(slot, event.target.value)}
            className={FIELD_TALL_CLASS}
          />
        )}
        {(control === "text" || control === "mono") && (
          <input
            type="text"
            aria-label={def.label}
            placeholder={slotPlaceholder(def)}
            value={text}
            maxLength={def.max}
            onChange={(event) => onChange(slot, event.target.value)}
            className={control === "mono" ? FIELD_MONO_CLASS : FIELD_TEXT_CLASS}
          />
        )}
      </div>
    </div>
  );
}
