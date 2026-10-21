import { Button } from "@heroui/react";
import { Icon } from "@/core/ui";

export function ArchivedBanner({ onUnarchive }: { onUnarchive: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-surface-secondary px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name="clipboard" size={13} />
        Archived. Unarchive to edit and resume scheduling.
      </span>
      <Button size="sm" variant="secondary" onPress={onUnarchive}>
        Unarchive to edit
      </Button>
    </div>
  );
}
