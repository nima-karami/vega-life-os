import { Button } from "@heroui/react";
import { Icon, useCompact } from "@/core/ui";

export function CardPageFooter({ onDelete }: { onDelete: () => void }) {
  const isCompact = useCompact();
  return (
    <footer className="mt-3 border-border border-t pt-3.5 sm:mt-9 sm:pt-5">
      <Button
        size="sm"
        variant="ghost"
        onPress={onDelete}
        className="h-11 gap-1.5 px-0 font-medium text-[15px] text-danger sm:h-auto sm:text-[13px]"
      >
        <Icon name="trash" size={isCompact ? 16 : 14} />
        Delete card
      </Button>
    </footer>
  );
}
