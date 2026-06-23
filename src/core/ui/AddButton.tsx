import { Button } from "@heroui/react";
import { forwardRef } from "react";
import { Icon } from "./icons";

/** Shared full-width "+ Add …" entry point — identical across Today, Habits, Values. */
export const AddButton = forwardRef<HTMLButtonElement, { label: string; onPress: () => void }>(
  ({ label, onPress }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="flat"
      onPress={onPress}
      startContent={<Icon name="plus" size={16} />}
      className="w-full justify-start font-normal text-default-500 data-[hover=true]:text-foreground"
    >
      {label}
    </Button>
  ),
);
AddButton.displayName = "AddButton";
