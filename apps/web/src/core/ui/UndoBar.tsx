import { Button, Card } from "@heroui/react";
import { cx } from "./cx";

/** Inline undo affordance for a recent destructive action (no native confirm). */
export function UndoBar({
  message,
  onUndo,
  tone,
}: {
  message: string;
  onUndo: () => void;
  /** the inverted ink surface — spec §11 gives it to the undo bar and nothing else */
  tone?: "ink";
}) {
  const isInk = tone === "ink";
  return (
    <div className="safe-mb pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <Card
        role="status"
        className={cx(
          "w-full pointer-events-auto rounded-[12px] border sm:w-auto",
          isInk ? "border-transparent bg-foreground" : "border-border bg-surface",
        )}
      >
        <Card.Content className="flex flex-row items-center gap-3 px-4 py-2.5">
          <span className={cx("flex-1 text-sm", isInk ? "text-background" : "text-foreground")}>
            {message}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className={cx("shrink-0", isInk ? "text-background" : undefined)}
            onPress={onUndo}
          >
            Undo
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
