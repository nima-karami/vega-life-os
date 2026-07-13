import { Button, Card } from "@heroui/react";

/** Inline undo affordance for a recent destructive action (no native confirm). */
export function UndoBar({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="safe-mb pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <Card className="pointer-events-auto rounded-[12px] border border-border bg-surface">
        <Card.Content className="flex flex-row items-center gap-3 px-4 py-2.5">
          <span className="text-sm text-foreground">{message}</span>
          <Button size="sm" variant="ghost" onPress={onUndo}>
            Undo
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
