import type { MappingWorkedExample } from "./import";
import { formatCents } from "./money";

/**
 * The confirmation gate, not decoration: a silent DD/MM↔MM/DD misread shifts a third of the
 * rows across month boundaries without erroring, and this is the only screen that catches it.
 */
export function FinanceWorkedExample({ example }: { example: MappingWorkedExample | null }) {
  if (!example) {
    return <p className="text-sm text-muted">No rows to read a date or an amount from.</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted">Dates read as</dt>
        <dd className="text-sm text-foreground tabular-nums">
          “{example.rawDate}” → {example.dateLabel}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Amounts read as</dt>
        <dd className="text-sm text-foreground tabular-nums">
          “{example.rawAmount}” → {formatCents(example.amountCents)}, {example.directionLabel}
        </dd>
      </div>
    </dl>
  );
}
