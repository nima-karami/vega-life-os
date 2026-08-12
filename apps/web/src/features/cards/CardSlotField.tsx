import type { SlotDef, SlotId } from "@vega/shared";
import { useId } from "react";
import { FIELD_CLASS } from "./CategoryField";
import { CharCounter } from "./CharCounter";

export function CardSlotField({
  slot,
  def,
  value,
  onChange,
}: {
  slot: SlotId;
  def: SlotDef;
  value: string;
  onChange: (next: string) => void;
}) {
  const fieldId = useId();
  const isTall = def.lines === "tall";
  const isList = slot === "examples" || slot === "synonyms";
  const ariaLabel = slot === "title" ? "Card title" : slot === "body" ? "Card body" : def.label;
  return (
    <div className="block space-y-2.5">
      <label htmlFor={fieldId} className="flex items-center gap-2">
        <span className="text-xs text-muted">{def.label}</span>
        {!isList && <CharCounter length={value.length} max={def.max} />}
      </label>
      {isTall || isList ? (
        <textarea
          id={fieldId}
          aria-label={ariaLabel}
          value={value}
          rows={isTall ? 6 : 3}
          maxLength={isList ? undefined : def.max}
          placeholder={isList ? "One per line" : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD_CLASS} resize-y`}
        />
      ) : (
        <input
          id={fieldId}
          type="text"
          aria-label={ariaLabel}
          value={value}
          maxLength={def.max}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_CLASS}
        />
      )}
    </div>
  );
}
