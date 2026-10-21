import { Button, ButtonGroup } from "@heroui/react";
import { Panel } from "@/core/ui";
import type { Value } from "@/features/values/model";
import { useValueColor } from "@/features/values/useValueColor";
import { CHECK_IN_LABELS, type ReviewCheckIn } from "./model";
import { toggleCheckIn } from "./review-form";

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
    <div className="flex flex-col gap-2">
      <div className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
          />
          {value.name}
        </span>
        {value.desc.trim() !== "" && (
          <p className="mt-0.5 truncate text-xs text-muted">{value.desc}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <ButtonGroup aria-label={value.name}>
            {CHECK_IN_LABELS.map((label, i) => (
              <Button
                key={label}
                size="sm"
                className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
                variant={rating === i + 1 ? "primary" : "secondary"}
                aria-pressed={rating === i + 1}
                aria-label={label}
                onPress={() => onChange(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
          </ButtonGroup>
          <div className="flex justify-between text-[11px] text-muted">
            <span>{CHECK_IN_LABELS[0]}</span>
            <span>{CHECK_IN_LABELS[4]}</span>
          </div>
        </div>
        {rating != null && (
          <span className="text-xs text-muted">{CHECK_IN_LABELS[rating - 1]}</span>
        )}
      </div>
    </div>
  );
}

export function ValueCheckIn({
  values,
  checkIns,
  onChange,
}: {
  values: Value[];
  checkIns: ReviewCheckIn[];
  onChange: (next: ReviewCheckIn[]) => void;
}) {
  return (
    <Panel className="p-4 sm:p-6">
      <h3 className="text-sm font-medium text-foreground">
        How consistently did you live each value this week?
      </h3>
      <p className="mt-1 text-xs text-muted">Your own sense of it — no right answer.</p>
      {values.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          Nothing in season right now — bring a value back when you&apos;re ready.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-5">
        {values.map((value) => (
          <CheckInRow
            key={value.id}
            value={value}
            rating={checkIns.find((c) => c.valueId === value.id)?.rating}
            onChange={(rating) => onChange(toggleCheckIn(checkIns, value.id, rating))}
          />
        ))}
      </div>
    </Panel>
  );
}
