import { Chip, CloseButton } from "@heroui/react";
import type { SlotDef } from "@vega/shared";
import { type KeyboardEvent as ReactKeyboardEvent, useState } from "react";
import { Icon } from "@/core/ui";
import { addChipValue, canAddListItem, removeChipAt } from "./slot-lists";

export function SynonymsField({
  def,
  values,
  onChange,
}: {
  def: SlotDef;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const singular = def.label.replace(/s$/, "").toLowerCase();
  const [entry, setEntry] = useState("");

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onChange(addChipValue(values, entry, def));
      setEntry("");
      return;
    }
    if (event.key === "Backspace" && entry === "" && values.length > 0) {
      onChange(removeChipAt(values, values.length - 1));
    }
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-[12px] border border-border bg-surface px-2.5 py-[7px] focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
      {values.map((chip, index) => (
        <Chip
          key={chip}
          size="sm"
          variant="soft"
          className="h-[26px] gap-[5px] rounded-[10px] bg-surface-secondary px-[9px] text-foreground text-xs"
        >
          <Chip.Label>{chip}</Chip.Label>
          {/* Pinned to 14px: CloseButton is 24px by default and would fill a 26px chip. */}
          <CloseButton
            aria-label={`Remove ${chip}`}
            onPress={() => onChange(removeChipAt(values, index))}
            className="-mr-1 h-4 w-4 p-0 opacity-55"
          >
            <Icon name="close" size={11} />
          </CloseButton>
        </Chip>
      ))}
      {canAddListItem(values, def) && (
        <input
          type="text"
          aria-label={`Add a ${singular}`}
          placeholder={`Add a ${singular}…`}
          value={entry}
          maxLength={def.max}
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-28 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted sm:text-[13px]"
        />
      )}
    </div>
  );
}
