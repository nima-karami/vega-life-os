import { Button, Card } from "@heroui/react";
import { useStore } from "@/core/store";
import { getValueColor } from "@/features/values/color";
import { splitValuesBySeason } from "@/features/values/selectors";

export function FreshStartCard({ onDismiss }: { onDismiss: () => void }) {
  const values = useStore((s) => s.values);
  const { inSeason } = splitValuesBySeason(values);

  return (
    <section aria-label="A new week">
      <Card className="rounded-[16px] border border-border bg-surface">
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">A new week starts today.</p>
            <Button variant="ghost" size="sm" onPress={onDismiss}>
              Got it
            </Button>
          </div>
          {inSeason.length > 0 && (
            <ul aria-label="In season" className="flex flex-wrap gap-1.5">
              {inSeason.map((value) => (
                <li
                  key={value.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-foreground"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: getValueColor(value) }}
                  />
                  <span className="truncate">{value.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
