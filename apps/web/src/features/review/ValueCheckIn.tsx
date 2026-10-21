import { Button, ButtonGroup } from "@heroui/react";
import { Panel } from "@/core/ui";
import type { Value } from "@/features/values/model";
import { useValueColor } from "@/features/values/useValueColor";
import { CHECK_IN_LABELS, type ReviewCheckIn } from "./model";
import { toggleCheckIn } from "./review-form";
import { ValueBullseye } from "./ValueBullseye";

function CheckInRow({
  value,
  rating,
  onChange,
}: {
  value: Value;
  rating: number | undefined;
  onChange: (rating: number) => void;
}) {
  const color = useValueColor(value.id);
  return (
    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="flex min-w-0 max-w-full items-center gap-2 text-sm text-foreground">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{value.name}</span>
        <span className="shrink-0 text-xs text-muted">
          {rating != null ? CHECK_IN_LABELS[rating - 1] : "Not rated"}
        </span>
      </span>
      <ButtonGroup aria-label={value.name}>
        {CHECK_IN_LABELS.map((label, i) => (
          <Button
            key={label}
            size="sm"
            className="h-8 min-w-8 px-0"
            variant={rating === i + 1 ? "primary" : "secondary"}
            aria-pressed={rating === i + 1}
            aria-label={label}
            onPress={() => onChange(i + 1)}
          >
            {i + 1}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}

export function ValueCheckIn({
  values,
  hasResting,
  checkIns,
  onChange,
}: {
  values: Value[];
  hasResting: boolean;
  checkIns: ReviewCheckIn[];
  onChange: (next: ReviewCheckIn[]) => void;
}) {
  return (
    <Panel className="p-4 sm:p-6">
      <h3 className="text-sm font-medium text-foreground">
        How consistently did you live each value this week?
      </h3>
      <p className="mt-1 text-xs text-muted">Your own sense of it. No right answer.</p>
      {values.length === 0 && hasResting && (
        <p className="mt-4 text-sm text-muted">
          Nothing in season right now. Bring a value back when you&apos;re ready.
        </p>
      )}
      {values.length > 0 && (
        <>
          <div className="mt-4">
            <ValueBullseye values={values} checkIns={checkIns} onChange={onChange} />
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
            {values.map((value) => (
              <CheckInRow
                key={value.id}
                value={value}
                rating={checkIns.find((c) => c.valueId === value.id)?.rating}
                onChange={(rating) => onChange(toggleCheckIn(checkIns, value.id, rating))}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
