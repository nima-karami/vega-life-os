import { Button } from "@heroui/react";
import { Icon } from "@/core/ui";
import { type DayEntry, getEntryStatus } from "@/features/journal";
import "./journal-entry-button.css";

export function JournalEntryButton({
  entry,
  onPress,
}: {
  entry: DayEntry | undefined;
  onPress: () => void;
}) {
  const hasEntry = getEntryStatus(entry) !== "none";
  return (
    <Button variant="secondary" size="sm" onPress={onPress} data-gratitude-target="">
      <Icon name="note" size={15} />
      {hasEntry ? "Edit entry" : "Journal"}
      {hasEntry && (
        <span
          className="journal-entry-dot -ml-0.5 h-1.5 w-1.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}
