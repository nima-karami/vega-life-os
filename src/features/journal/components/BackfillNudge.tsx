import { Button, Card } from "@heroui/react";
import { formatLongDate } from "@/core/lib/date";
import { Icon, IconButton } from "@/core/ui";

/**
 * A quiet, non-blocking reminder that recent days are missing gratitude. It never
 * gates navigation — it only surfaces the gap and deep-links to backfill it. Anchored
 * on gratitude (the enforced daily ritual); adding the entry repairs the streak.
 */
export function BackfillNudge({
  missedDays,
  onAdd,
  onReviewAll,
  onDismiss,
}: {
  missedDays: string[];
  onAdd: (date: string) => void;
  onReviewAll: () => void;
  onDismiss: () => void;
}) {
  if (missedDays.length === 0) return null;
  const recent = missedDays[0];
  const hasMultiple = missedDays.length > 1;

  return (
    <Card
      className="mb-4 rounded-[16px] border border-border bg-surface-secondary"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon name="notebook-pen" size={18} className="shrink-0 text-muted" />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          {hasMultiple
            ? `You missed gratitude on ${missedDays.length} recent days.`
            : `You missed gratitude on ${formatLongDate(recent)} — add it?`}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onPress={() => onAdd(recent)}
            aria-label={`Add gratitude for ${formatLongDate(recent)}`}
          >
            Add entry
          </Button>
          {hasMultiple && (
            <Button size="sm" variant="ghost" onPress={onReviewAll}>
              Review all
            </Button>
          )}
          <IconButton name="close" size={16} label="Dismiss reminder" onPress={onDismiss} />
        </div>
      </div>
    </Card>
  );
}
