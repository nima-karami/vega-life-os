import { Button } from "@heroui/react";
import type { FinanceCategory, FinanceTransaction } from "@vega/shared";
import { useState } from "react";
import { cx, NONE, Select, type SelectOption } from "@/core/ui";
import { getCategoryColor } from "./category-palette";
import { DraftInput } from "./DraftInput";
import {
  FULL_SHARE_BPS,
  formatCents,
  formatShareBps,
  HOUSEHOLD_DEFAULT_BPS,
  parseShareBps,
} from "./money";
import { SegmentedChoice, type SegmentedOption, TransactionField } from "./TransactionField";
import { describeShareSentence } from "./transaction-detail-figures";

const SHARED_CHOICES: SegmentedOption<"mine" | "shared">[] = [
  { value: "mine", label: "Just mine" },
  { value: "shared", label: "Shared" },
];

export interface LedgerTriageProps {
  txn: FinanceTransaction;
  categories: FinanceCategory[];
  /** Where the row came from — the owner traces a figure back to its statement line. */
  provenance: string;
  isLast: boolean;
  onCommit: (patch: Partial<FinanceTransaction>) => void;
  onAdvance: () => void;
}

function buildCategoryChoices(categories: FinanceCategory[]): SelectOption[] {
  return [
    { value: NONE, label: "No category" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
      hue: getCategoryColor(category),
    })),
  ];
}

/**
 * The whole triage for one row, inline under it. Nothing is written until `Done — next row`, so a
 * half-set split never lands as a figure the owner did not agree to.
 */
export function LedgerTriage({
  txn,
  categories,
  provenance,
  isLast,
  onCommit,
  onAdvance,
}: LedgerTriageProps) {
  const [categoryId, setCategoryId] = useState(txn.categoryId ?? NONE);
  const [isHousehold, setIsHousehold] = useState(txn.isHousehold);
  const [shareBps, setShareBps] = useState(
    txn.isHousehold ? txn.myShareBps : HOUSEHOLD_DEFAULT_BPS,
  );

  const effectiveBps = isHousehold ? shareBps : FULL_SHARE_BPS;
  const { youBearCents } = describeShareSentence(txn.amountCents, effectiveBps, txn.payer);

  const commit = () => {
    onCommit({
      categoryId: categoryId === NONE ? null : categoryId,
      isHousehold,
      myShareBps: effectiveBps,
    });
    onAdvance();
  };

  return (
    <div
      className={cx(
        "flex flex-wrap items-end gap-3 bg-canvas py-3.5 pr-4 pl-18",
        !isLast && "border-b border-border",
      )}
    >
      <TransactionField label="Category" className="min-w-[12rem]">
        <Select
          ariaLabel={`File ${txn.description} under`}
          value={categoryId}
          options={buildCategoryChoices(categories)}
          onValueChange={setCategoryId}
        />
      </TransactionField>

      <TransactionField label="Shared">
        <SegmentedChoice
          ariaLabel="Shared"
          options={SHARED_CHOICES}
          value={isHousehold ? "shared" : "mine"}
          tone="accent"
          isFullWidth={false}
          onChange={(next) => setIsHousehold(next === "shared")}
        />
      </TransactionField>

      <TransactionField label="My share" className="w-28">
        <div className="flex items-center gap-1.5">
          <DraftInput
            type="number"
            min={0}
            max={100}
            step={0.01}
            ariaLabel="My share percent"
            value={formatShareBps(shareBps)}
            isDisabled={!isHousehold}
            onCommit={(raw) => {
              const bps = parseShareBps(raw);
              if (bps === null) return false;
              setShareBps(bps);
              return true;
            }}
          />
          <span aria-hidden className="text-[13px] text-muted">
            %
          </span>
        </div>
      </TransactionField>

      <p className="flex-1 pb-2 text-[12.5px] text-muted tabular-nums">
        You bear {formatCents(youBearCents)} · {provenance}
      </p>

      <Button variant="primary" onPress={commit}>
        Done — next row
      </Button>
    </div>
  );
}
