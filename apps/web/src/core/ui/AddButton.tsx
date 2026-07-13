import { Button } from "@heroui/react";
import { forwardRef } from "react";
import { Icon } from "./icons";

/** Shared full-width "+ Add …" entry point — identical across Today, Habits, Values. */
export const AddButton = forwardRef<HTMLButtonElement, { label: string; onPress: () => void }>(
  ({ label, onPress }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="secondary"
      onPress={onPress}
      className="w-full justify-start font-normal text-muted data-[hovered=true]:text-foreground"
    >
      <Icon name="plus" size={16} />
      {label}
    </Button>
  ),
);
AddButton.displayName = "AddButton";
