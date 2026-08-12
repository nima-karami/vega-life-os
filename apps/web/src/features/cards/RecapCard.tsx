import { Button } from "@heroui/react";
import { Icon } from "@/core/ui";

export interface RecapCardProps {
  seenThisPass: number;
  totalInRotation: number;
  learningCount: number;
  onNewCard: () => void;
}

export function RecapCard({
  seenThisPass,
  totalInRotation,
  learningCount,
  onNewCard,
}: RecapCardProps) {
  return (
    <section
      aria-label="Session recap"
      className="flex h-full w-full flex-col items-center justify-center gap-5 px-8 text-center"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Session recap</h2>
      <div className="space-y-1 text-sm text-muted tabular-nums">
        <p>{seenThisPass} cards seen this pass</p>
        <p>{totalInRotation} total in rotation</p>
        <p>{learningCount} in learning mode</p>
      </div>
      <p className="max-w-xs text-sm text-muted">
        That's the loop — add more or go do something real.
      </p>
      <Button variant="primary" onPress={onNewCard}>
        <Icon name="plus" size={15} />
        New card
      </Button>
    </section>
  );
}
