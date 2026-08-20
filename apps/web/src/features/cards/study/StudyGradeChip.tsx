import { describeRecallInterval } from "../feed-steps";
import { stepLeitner } from "../leitner";

/** `box` is the card's pre-grade box, matching describeRecallInterval's own convention. */
export function formatGradeChip(box: number, correct: boolean, today: string): string {
  const { box: nextBox } = stepLeitner(box, correct, today);
  return `Box ${nextBox} · next ${describeRecallInterval(box, correct, today)}`;
}

export function StudyGradeChip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-6">
      <span className="rounded-full border border-border bg-surface/95 px-4 py-2 font-medium text-[13px] text-foreground shadow-lg">
        {label}
      </span>
    </div>
  );
}
