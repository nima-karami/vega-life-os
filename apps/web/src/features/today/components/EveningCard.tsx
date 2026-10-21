import { Button, Card } from "@heroui/react";

export function EveningCard({
  onReflect,
  onDismiss,
}: {
  onReflect: () => void;
  onDismiss: () => void;
}) {
  return (
    <section aria-label="This evening">
      <Card className="rounded-[16px] border border-border bg-surface">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">This evening</h2>
            <p className="text-xs text-muted">How did today go?</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onPress={onDismiss}>
              Not tonight
            </Button>
            <Button variant="primary" onPress={onReflect}>
              Close the day
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
