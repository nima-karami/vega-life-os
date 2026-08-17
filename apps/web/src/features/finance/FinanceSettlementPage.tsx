import type { FinanceSettlement, FinanceTransaction } from "@vega/shared";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, ConfirmDialog, Select } from "@/core/ui";
import { FinancePageShell } from "./FinancePageShell";
import { formatCents } from "./money";
import {
  formatMonthLabel,
  isMonthKey,
  monthOfISO,
  shiftMonthKey,
  toMonthKey,
} from "./month-cursor";
import type { FinanceBook } from "./queries";
import { type SettlementAction, SettlementActions } from "./SettlementActions";
import { SettlementBalanceCard } from "./SettlementBalanceCard";
import { SettlementNotices } from "./SettlementNotices";
import { type SettlementPayment, SettlementPaymentEditor } from "./SettlementPaymentEditor";
import { SettlementStatusCard } from "./SettlementStatusCard";
import {
  buildCarryForwardWrites,
  buildSettlePatch,
  computeSettlementFigures,
  describeBalance,
  findNextOpenMonth,
  listSettlementMonths,
  type SettlementFigures,
} from "./settlement";
import { useFinanceBook } from "./useFinanceBook";

type FinalAction = Exclude<SettlementAction, "pay">;

const PHASE_SUMMARY = {
  open: "Open",
  settled: "Settled",
  amended: "Amended — the figure moved after it was settled",
} as const;

/** Rows the payment could have landed as: the owner's own, moving the right way, within three months. */
function selectPaymentCandidates(
  book: FinanceBook,
  figures: SettlementFigures,
): FinanceTransaction[] {
  const direction = figures.headlineBalanceCents < 0 ? -1 : 1;
  const until = shiftMonthKey(figures.month, 2);
  return book.financeTransactions
    .filter((txn) => {
      if (txn.isInternal || txn.payer !== "me") return false;
      if (Math.sign(txn.amountCents) !== direction) return false;
      const month = monthOfISO(txn.txnDate);
      return month >= figures.month && month <= until;
    })
    .sort((left, right) => (left.txnDate < right.txnDate ? 1 : -1))
    .slice(0, 20);
}

/** Reopening unlocks the month's rows for editing; the figure it was settled at is kept, not erased. */
const REOPEN_PATCH = { status: "open" } as const;

function describeFinalAction(
  action: FinalAction,
  figures: SettlementFigures,
  nextOpenMonth: string,
  partnerName: string,
) {
  if (action === "carry") {
    return {
      title: "Carry the difference forward?",
      confirmLabel: "Carry forward",
      body: `${formatCents(Math.abs(figures.outstandingCents))} moves into ${formatMonthLabel(nextOpenMonth)}. ${formatMonthLabel(figures.month)} keeps the figure it was settled at and closes out.`,
    };
  }
  if (action === "reopen") {
    return {
      title: "Reopen this month for editing?",
      confirmLabel: "Reopen",
      body: `${formatMonthLabel(figures.month)} unlocks so its rows can be edited again. The ${formatCents(Math.abs(figures.frozenBalanceCents ?? 0))} it was settled at is kept on record — settle again when you're done.`,
    };
  }
  return {
    title: "Freeze this month's figure?",
    confirmLabel: action === "resettle" ? "Re-settle" : "Settle",
    body: `${formatMonthLabel(figures.month)} settles at ${formatCents(Math.abs(figures.currentBalanceCents))} — ${describeBalance(figures.currentBalanceCents, "now", partnerName).toLowerCase()}. Later edits to these rows amend the month; they never rewrite this figure.`,
  };
}

export function FinanceSettlementPage() {
  const book = useFinanceBook();
  const addSettlement = useStore((s) => s.addFinanceSettlement);
  const updateSettlement = useStore((s) => s.updateFinanceSettlement);
  const loadFailed = useStore((s) => s.loadFailed);
  const refetchAll = useStore((s) => s.refetchAll);
  const partnerName = useStore((s) => s.partnerName);

  const [params, setParams] = useSearchParams();
  const [pendingAction, setPendingAction] = useState<FinalAction | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const thisMonth = toMonthKey(new Date());
  const months = useMemo(() => listSettlementMonths(book, thisMonth), [book, thisMonth]);
  const requestedMonth = params.get("month");
  const month =
    requestedMonth !== null && isMonthKey(requestedMonth)
      ? requestedMonth
      : (months[0] ?? thisMonth);
  // A deep-linked month the book has never heard of still has to name itself in the picker.
  const monthOptions = months.includes(month) ? months : [month, ...months];
  const figures = useMemo(() => computeSettlementFigures(book, month), [book, month]);
  const settlementRecord = book.financeSettlements.find((entry) => entry.month === month);
  const nextOpenMonth = findNextOpenMonth(book, month);

  const selectMonth = (next: string) => {
    const query = new URLSearchParams(params);
    query.set("month", next);
    setParams(query, { replace: true });
  };

  const writeSettlement = (target: string, patch: Partial<FinanceSettlement>) => {
    if (book.financeSettlements.some((entry) => entry.month === target)) {
      updateSettlement(target, patch);
      return;
    }
    addSettlement({ month: target, ...patch });
  };

  const handleSettlementAction = (action: SettlementAction) => {
    if (action === "pay") setIsPaying(true);
    else setPendingAction(action);
  };

  const confirmAction = () => {
    if (pendingAction === "carry") {
      for (const write of buildCarryForwardWrites(book, figures))
        writeSettlement(write.month, write.patch);
    } else if (pendingAction === "reopen") {
      writeSettlement(month, REOPEN_PATCH);
    } else if (pendingAction !== null) {
      writeSettlement(month, buildSettlePatch(figures, todayISO()));
    }
    setPendingAction(null);
  };

  const recordPayment = (payment: SettlementPayment) => {
    writeSettlement(month, payment);
    setIsPaying(false);
  };

  const confirmCopy = describeFinalAction(
    pendingAction ?? "settle",
    figures,
    nextOpenMonth,
    partnerName,
  );
  const hasAnyData = book.financeSettlements.length > 0 || figures.householdRowCount > 0;

  return (
    <FinancePageShell
      title="Settlement"
      subLine="What the household cost, whose card it landed on, and who owes whom this month."
      summary={`${formatMonthLabel(month)} · ${PHASE_SUMMARY[figures.phase]} · ${describeBalance(figures.headlineBalanceCents, "now", partnerName)}`}
      headerAction={
        <SettlementActions
          figures={figures}
          nextOpenMonth={nextOpenMonth}
          onSelectAction={handleSettlementAction}
        />
      }
      filters={
        <Select
          ariaLabel="Settlement month"
          className="sm:w-56"
          value={month}
          onValueChange={selectMonth}
          options={monthOptions.map((entry) => ({ value: entry, label: formatMonthLabel(entry) }))}
        />
      }
      isEmpty={!hasAnyData}
      empty={{
        title: "Nothing to settle yet",
        body: "Mark expenses as household and give each a share — the month's balance builds from there.",
      }}
      hasNoMatches={figures.householdRowCount === 0 && settlementRecord === undefined}
      noMatches={{
        title: `No household expenses in ${formatMonthLabel(month)}`,
        body: "Nothing was shared this month, so there is nothing to split.",
        cta: (
          <Button solid onPress={() => selectMonth(thisMonth)}>
            Back to this month
          </Button>
        ),
      }}
    >
      <SettlementNotices hasLoadFailed={loadFailed} onRetry={() => void refetchAll()} />
      <SettlementBalanceCard figures={figures} partnerName={partnerName} />
      <SettlementStatusCard figures={figures} partnerName={partnerName} />

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        onConfirm={confirmAction}
        onClose={() => setPendingAction(null)}
      />

      {isPaying && (
        <SettlementPaymentEditor
          figures={figures}
          candidates={selectPaymentCandidates(book, figures)}
          isOpen={isPaying}
          onClose={() => setIsPaying(false)}
          onSave={recordPayment}
        />
      )}
    </FinancePageShell>
  );
}
