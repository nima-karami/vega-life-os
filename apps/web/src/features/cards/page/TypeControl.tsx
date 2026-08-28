import { Button, ButtonGroup } from "@heroui/react";
import type { CardTypeId } from "@vega/shared";
import { useCompact } from "@/core/ui";
import { listTypeOptions } from "./card-fields";

/** 92px cells at 320px: "Vocabulary" is 76px of text, so the padding has to come down to px-1.5. */
const GRID_CELL_CLASS = "h-11 w-full px-1.5 font-medium text-sm";
const ROW_CELL_CLASS = "h-11 px-3 font-medium text-sm sm:h-auto sm:py-1.5 sm:text-[13px]";

/** Six types never fit one phone row, so compact gets a 3×2 grid; from sm they butt-join. */
export function TypeControl({
  value,
  onChange,
}: {
  value: CardTypeId;
  onChange: (next: CardTypeId) => void;
}) {
  const isCompact = useCompact();
  const cells = listTypeOptions().map((option) => (
    <Button
      key={option.id}
      size="sm"
      variant={value === option.id ? "primary" : "secondary"}
      aria-pressed={value === option.id}
      onPress={() => onChange(option.id)}
      className={isCompact ? GRID_CELL_CLASS : ROW_CELL_CLASS}
    >
      {option.label}
    </Button>
  ));

  if (isCompact) {
    return (
      <fieldset aria-label="Card type" className="grid min-w-0 grid-cols-3 gap-1.5">
        {cells}
      </fieldset>
    );
  }
  return <ButtonGroup aria-label="Card type">{cells}</ButtonGroup>;
}
