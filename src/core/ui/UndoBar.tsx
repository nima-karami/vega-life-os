import { Button, Card, CardBody } from "@heroui/react";

/** Inline undo affordance for a recent destructive action (no native confirm). */
export function UndoBar({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="safe-mb pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <Card
        shadow="sm"
        radius="md"
        className="pointer-events-auto border border-divider bg-content1"
      >
        <CardBody className="flex flex-row items-center gap-3 px-4 py-2.5">
          <span className="text-small text-foreground">{message}</span>
          <Button size="sm" variant="light" color="primary" onPress={onUndo}>
            Undo
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
