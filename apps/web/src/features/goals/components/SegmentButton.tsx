import { Button } from "@heroui/react";
import type { ReactNode } from "react";

/** A segmented-control cell: a HeroUI toggle Button (aria-pressed); selected = primary fill. */
export function SegmentButton({
  isSelected,
  onClick,
  isDisabled,
  children,
}: {
  isSelected: boolean;
  onClick: () => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      size="sm"
      aria-pressed={isSelected}
      isDisabled={isDisabled}
      variant={isSelected ? "primary" : "outline"}
      onPress={onClick}
      className="flex-1"
    >
      {children}
    </Button>
  );
}
