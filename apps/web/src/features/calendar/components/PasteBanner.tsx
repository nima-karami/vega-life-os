import { Button, Card } from "@heroui/react";
import { Icon } from "@/core/ui";

export function PasteBanner({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <Card className="mb-4 rounded-[16px] border border-border bg-surface">
      <div className="flex items-center gap-x-3 px-4 py-3">
        <Icon name="clipboard" size={15} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">Copied “{title}”</span>
        <span className="hidden shrink-0 text-sm text-muted sm:inline">
          Click an empty slot to place it, or a chip to replace
        </span>
        <Button
          size="sm"
          variant="ghost"
          onPress={onCancel}
          aria-label="Cancel paste"
          className="ml-auto shrink-0 text-muted"
        >
          <Icon name="close" size={12} />
          Cancel · Esc
        </Button>
      </div>
    </Card>
  );
}
