import { Button as HeroButton } from "@heroui/react";
import type { FinanceSettlement, FinanceTransaction } from "@vega/shared";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, ConfirmDialog, Icon } from "@/core/ui";
import { FinancePageShell } from "./FinancePageShell";
import {
  formatMonthLabel,
  isMonthKey,
  monthOfISO,
  shiftMonthKey,
  toMonthKey,
} from "./month-cursor";
import type { FinanceBook } from "./queries";
import { SettlementHistoryCard } from "./SettlementHistoryCard";
import { SettlementNotices } from "./SettlementNotices";
import { type SettlementPayment, SettlementPaymentEditor } from "./SettlementPaymentEditor";
import { type SettlementAction, SettlementPeriodActions } from "./SettlementPeriodActions";
import { SettlementPeriodCard } from "./SettlementPeriodCard";
import { SettlementRowsCard } from "./SettlementRowsCard";
import {
  buildCarryForwardWrites,
  buildSettlePatch,
  computeSettlementDirection,
  computeSettlementFigures,
  findNextOpenMonth,
  listSettlementMonths,
  type SettlementFigures,
} from "./settlement";
import {
  describeSettlementConfirmCopy,
  describeSettlementSubLine,
  resolvePartnerName,
  type SettlementConfirmAction,
} from "./settlement-copy";
import {
  buildSettlementHistory,
  buildSettlementRowViews,
  partitionSettlementSplits,
  type SettlementRowFilter,
} from "./settlement-rows";
import { useFinanceBook } from "./useFinanceBook";

type FreezeAction = "settle" | "resettle";

/** Rows the payment could have landed as: the owner's own, moving the right way, within three months. */
function selectPaymentCandidates(
  book: FinanceBook,
  figures: SettlementFigures,
): FinanceTransaction[] {
  const direction = computeSettlementDirection(figures);
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

/** Reopening unlocks the period's rows for editing; the figure it was settled at is kept, not erased. */
const REOPEN_PATCH = { status: "open" } as const;

const isPeriodOpen = (book: FinanceBook, month: string): boolean => {
  const record = book.financeSettlements.find((entry) => entry.month === month);
  return record === undefined || record.status === "open";
};

/** An amended period re-freezes at the new figure; an open one freezes for the first time. */
function selectFreezeAction(figures: SettlementFigures): FreezeAction | null {
  if (figures.phase === "amended") return "resettle";
  if (figures.phase === "open" && figures.householdRowCount > 0) return "settle";
  return null;
}

export function FinanceSettlementPage() {
  const book = useFinanceBook();
  const addSettlement = useStore((s) => s.addFinanceSettlement);
  const updateSettlement = useStore((s) => s.updateFinanceSettlement);
  const loadFailed = useStore((s) => s.loadFailed);
  const refetchAll = useStore((s) => s.refetchAll);
  const partnerName = useStore((s) => s.partnerName);

  const [params, setParams] = useSearchParams();
  const [pendingAction, setPendingAction] = useState<SettlementConfirmAction | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [rowFilter, setRowFilter] = useState<SettlementRowFilter>("all");

  const thisMonth = toMonthKey(new Date());
  const months = useMemo(() => listSettlementMonths(book, thisMonth), [book, thisMonth]);
  const openMonths = useMemo(
    () => months.filter((entry) => isPeriodOpen(book, entry)),
    [book, months],
  );
  const requestedMonth = params.get("month");
  const month =
    requestedMonth !== null && isMonthKey(requestedMonth)
      ? requestedMonth
      : (openMonths[0] ?? months[0] ?? thisMonth);

  const figures = useMemo(() => computeSettlementFigures(book, month), [book, month]);
  const rowViews = useMemo(() => buildSettlementRowViews(book, month), [book, month]);
  const partition = useMemo(() => partitionSettlementSplits(rowViews), [rowViews]);
  const history = useMemo(() => buildSettlementHistory(book, partnerName), [book, partnerName]);
  const settlementRecord = book.financeSettlements.find((entry) => entry.month === month);
  const nextOpenMonth = findNextOpenMonth(book, month);
  const freezeAction = selectFreezeAction(figures);
  const partnerLabel = resolvePartnerName(partnerName);

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

  const handlePeriodAction = (action: SettlementAction) => {
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

  const confirmCopy = describeSettlementConfirmCopy(
    pendingAction ?? "settle",
    figures,
    nextOpenMonth,
    partnerName,
  );
  const hasAnyData = book.financeSettlements.length > 0 || figures.householdRowCount > 0;

  return (
    <FinancePageShell
      title="Settlement"
      subLine={describeSettlementSubLine(openMonths.length, figures.householdRowCount, month)}
      headerAction={
        freezeAction !== null && (
          <HeroButton variant="primary" onPress={() => setPendingAction(freezeAction)}>
            <Icon name="check" size={16} />
            {freezeAction === "resettle" ? "Re-settle" : "Record settlement"}
          </HeroButton>
        )
      }
      isEmpty={!hasAnyData}
      empty={{
        title: "Nothing to settle yet",
        body: "Mark expenses as household and give each a share. The period's balance builds from there.",
      }}
      hasNoMatches={figures.householdRowCount === 0 && settlementRecord === undefined}
      noMatches={{
        title: `No household expenses in ${formatMonthLabel(month)}`,
        body: "Nothing was shared in this period, so there is nothing to split.",
        cta: (
          <Button solid onPress={() => selectMonth(thisMonth)}>
            Back to this month
          </Button>
        ),
      }}
    >
      <SettlementNotices hasLoadFailed={loadFailed} onRetry={() => void refetchAll()} />

      <SettlementPeriodCard
        figures={figures}
        partition={partition}
        partnerName={partnerName}
        actions={
          <SettlementPeriodActions
            figures={figures}
            nextOpenMonth={nextOpenMonth}
            onSelectAction={handlePeriodAction}
          />
        }
      />

      <SettlementRowsCard
        views={rowViews}
        figures={figures}
        filter={rowFilter}
        partnerName={partnerLabel}
        onSelectFilter={setRowFilter}
      />

      {history.length > 0 && <SettlementHistoryCard rows={history} />}

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
          partnerName={partnerLabel}
          isOpen={isPaying}
          onClose={() => setIsPaying(false)}
          onSave={recordPayment}
        />
      )}
    </FinancePageShell>
  );
}
