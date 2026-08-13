import { Button, ButtonGroup } from "@heroui/react";
import type { CardTypeId } from "@vega/shared";
import { listTypeOptions } from "./card-fields";

/** Six types cannot sit on one 358px row, so the group wraps; everything else is stock. */
export function TypeControl({
  value,
  onChange,
}: {
  value: CardTypeId;
  onChange: (next: CardTypeId) => void;
}) {
  return (
    <ButtonGroup aria-label="Card type" className="flex-wrap">
      {listTypeOptions().map((option) => (
        <Button
          key={option.id}
          size="sm"
          variant={value === option.id ? "primary" : "secondary"}
          aria-pressed={value === option.id}
          onPress={() => onChange(option.id)}
          className="h-11 px-3 font-medium text-sm sm:h-auto sm:py-1.5 sm:text-[13px]"
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
