import type { ReactNode } from "react";
import { cx } from "@/core/ui";
import { formatCents } from "./money";
import { ReconciliationBar } from "./primitives";
import { SettlementPeriodNotes } from "./SettlementPeriodNotes";
import { buildReconciliationSegments, describeBalance, type SettlementFigures } from "./settlement";
import {
  describePeriodStatus,
  describeSettlementScope,
  listSettlementNotes,
  resolvePartnerName,
} from "./settlement-copy";
import type { SettlementSplitPartition } from "./settlement-rows";

const ACCENT = "#4E6E8E";
const STAT_BOX_CLASS = "rounded-[12px] border border-border px-[13px] py-[11px]";
const SWATCH_CLASS = "inline-block size-2 rounded-[2px] align-baseline";

const DOT_TONE = {
  open: "bg-warning",
  amended: "bg-warning",
  settled: "bg-success",
} as const;

interface LegendEntry {
  text: string;
  swatch: "lead" | "trail" | null;
}

function LegendSpan({ entry }: { entry: LegendEntry }) {
  return (
    <span>
      {entry.swatch === "lead" && (
        <span aria-hidden className={cx(SWATCH_CLASS, "mr-1.5")} style={{ background: ACCENT }} />
      )}
      {entry.text}
      {entry.swatch === "trail" && (
        <span
          aria-hidden
          className={cx(SWATCH_CLASS, "ml-1.5 border border-[rgba(0,0,0,.12)] bg-paper-3")}
        />
      )}
    </span>
  );
}

function StatBox({
  label,
  value,
  isWarning,
}: {
  label: string;
  value: string;
  isWarning: boolean;
}) {
  return (
    <div className={STAT_BOX_CLASS}>
      <p className="text-[11.5px] text-muted">{label}</p>
      <p
        className={cx(
          "mt-0.5 font-semibold text-[15px] tabular-nums",
          isWarning ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export interface SettlementPeriodCardProps {
  figures: SettlementFigures;
  partition: SettlementSplitPartition;
  partnerName: string;
  /** The secondary actions the period's phase allows, rendered under the notes. */
  actions: ReactNode;
}

/**
 * The one number that matters, what it was built from, and what stands in its way — the whole
 * settle decision on one card, with the blocker deliberately next to the button that acts on it.
 */
export function SettlementPeriodCard({
  figures,
  partition,
  partnerName,
  actions,
}: SettlementPeriodCardProps) {
  const partner = resolvePartnerName(partnerName);
  const segments = buildReconciliationSegments(figures);
  const legend: LegendEntry[] = [
    { text: `You paid ${formatCents(figures.ownerPaidCents)}`, swatch: "lead" },
    { text: `your true share ${formatCents(figures.myShareCents)}`, swatch: null },
    { text: `${partner} paid ${formatCents(figures.partnerPaidCents)}`, swatch: "trail" },
  ];

  return (
    <section
      aria-label="The period being settled"
      className="mt-4 grid items-start gap-6 rounded-[16px] border border-border bg-surface px-[22px] py-5 shadow-soft lg:grid-cols-[1fr_20rem]"
    >
      <div>
        <p className="flex items-center gap-[9px] text-[12px] text-muted">
          <span aria-hidden className={cx("size-[7px] rounded-full", DOT_TONE[figures.phase])} />
          {describePeriodStatus(figures)}
        </p>
        <p className="mt-2 mb-1 font-semibold text-[30px] text-foreground tracking-[-0.025em] tabular-nums">
          {describeBalance(figures.headlineBalanceCents, "now", partnerName)}
        </p>
        <p className="text-[13.5px] text-muted">{describeSettlementScope(figures)}</p>

        <ReconciliationBar
          className="mt-5 mb-2.5"
          fillPercent={segments.ownerPaidPercent}
          markerPercent={segments.trueShareMarkerPercent}
          label={`You paid ${Math.round(segments.ownerPaidPercent)}% of the household total; your true share is ${Math.round(segments.trueShareMarkerPercent)}%.`}
        />
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px] text-muted tabular-nums">
          {legend.map((entry) => (
            <LegendSpan key={entry.text} entry={entry} />
          ))}
        </div>

        <div className="mt-[18px] grid gap-2.5 sm:grid-cols-3">
          <StatBox
            label="Rows at 50/50"
            value={`${partition.evenCount} · ${formatCents(partition.evenCents)}`}
            isWarning={false}
          />
          <StatBox
            label="Rows at another split"
            value={`${partition.otherCount} · ${formatCents(partition.otherCents)}`}
            isWarning={false}
          />
          <StatBox
            label="Waiting on review"
            value={`${figures.excludedCount} · ${formatCents(figures.excludedCents)}`}
            isWarning={figures.excludedCount > 0}
          />
        </div>
      </div>

      <SettlementPeriodNotes
        title={figures.phase === "open" ? "Before you settle" : "Where this period stands"}
        notes={listSettlementNotes(figures)}
        actions={actions}
      />
    </section>
  );
}
