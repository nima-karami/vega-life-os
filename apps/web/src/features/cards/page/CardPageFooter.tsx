import { Button } from "@heroui/react";
import { Icon, useBelowLarge } from "@/core/ui";

export function CardPageFooter({ onDelete }: { onDelete: () => void }) {
  const isBelowLarge = useBelowLarge();
  return (
    <footer className="mt-3 border-border border-t pt-3.5 lg:mt-9 lg:pt-5">
      <Button
        size="sm"
        variant="ghost"
        onPress={onDelete}
        className="h-11 gap-1.5 px-0 font-medium text-[15px] text-danger lg:h-auto lg:text-[13px]"
      >
        <Icon name="trash" size={isBelowLarge ? 16 : 14} />
        Delete card
      </Button>
    </footer>
  );
}
