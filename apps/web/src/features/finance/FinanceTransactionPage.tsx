import { Button } from "@heroui/react";
import type { FinanceImportBatch, FinanceTransaction } from "@vega/shared";
import { useState } from "react";
import { useParams } from "react-router";
import { useStore } from "@/core/store";
import { Icon, UndoBar } from "@/core/ui";
import { FinancePageShell } from "./FinancePageShell";
import { TransactionFormFields } from "./TransactionFormFields";
import { describeSaveState, describeTransactionProvenance } from "./transaction-copy";
import {
  describeFormErrors,
  diffTransactionPatch,
  readTransactionForm,
  selectAssignableCategories,
  type TransactionFormValues,
} from "./transaction-form";
import {
  isTransactionLocked,
  listSettledMonths,
  resolveTransactionTitle,
} from "./transactions-query";
import { useAutosavedText } from "./useAutosavedText";

const BACK_LINK = { to: "/finance/transactions", label: "Transactions" } as const;

// No rule at rest — this row already has a name; the affordance only shows once it has focus.
const TITLE_CLASS =
  "w-full border-transparent border-b-[1.5px] bg-transparent pb-1.5 font-semibold text-3xl text-foreground tracking-[-0.025em] leading-[1.15] outline-none focus:border-accent";

/** A row opens as its own page, the way a habit or a goal does — and it saves itself as you work. */
export function FinanceTransactionPage() {
  const { transactionId } = useParams();
  const transaction = useStore((s) =>
    s.financeTransactions.find((row) => row.id === transactionId),
  );
  const merchants = useStore((s) => s.financeMerchants);
  const addFinanceTransaction = useStore((s) => s.addFinanceTransaction);
  const [archived, setArchived] = useState<FinanceTransaction | null>(null);

  if (archived !== null) {
    const merchant = merchants.find((row) => row.id === archived.merchantId) ?? null;
    return (
      <>
        <FinancePageShell
          title="Archived"
          subLine="It is off the ledger, but nothing about it was rewritten."
          width="regular"
          backLink={BACK_LINK}
          isEmpty
          empty={{
            title: `${resolveTransactionTitle(archived, merchant)} is archived`,
            body: "Undo puts the row back exactly as it stood, dedupe key and provenance included.",
          }}
        />
        <UndoBar
          tone="ink"
          message="Transaction archived"
          onUndo={() => {
            addFinanceTransaction(archived);
            setArchived(null);
          }}
        />
      </>
    );
  }

  if (!transaction)
    return (
      <FinancePageShell
        title="Transaction"
        subLine="Nothing on file under that link."
        width="regular"
        backLink={BACK_LINK}
        isEmpty
        empty={{
          title: "This transaction no longer exists",
          body: "It was archived or rolled back with its import. The ledger has what is left.",
        }}
      />
    );

  return <TransactionEditor txn={transaction} onArchive={setArchived} />;
}

function ProvenanceStrip({
  txn,
  batches,
  isSettled,
}: {
  txn: FinanceTransaction;
  batches: FinanceImportBatch[];
  isSettled: boolean;
}) {
  const { lead, reference, trail } = describeTransactionProvenance(txn, batches, isSettled);
  return (
    <p className="flex items-center gap-2.5 rounded-[12px] bg-paper-2 px-4 py-3 text-[12.5px] text-muted">
      <Icon name="file-input" size={15} className="shrink-0" aria-hidden />
      <span className="min-w-0">
        {lead}
        {reference !== "" && (
          <>
            {" "}
            <span className="font-mono text-[11px] text-foreground">{reference}</span>
          </>
        )}
        {` · ${trail}`}
      </span>
    </p>
  );
}

/** The four fields a keystroke storms — everything else on this page commits the moment it moves. */
const TEXT_KEYS = ["title", "amountInput", "sharePercentInput", "note"] as const;

function TransactionEditor({
  txn,
  onArchive,
}: {
  txn: FinanceTransaction;
  onArchive: (row: FinanceTransaction) => void;
}) {
  const categories = useStore((s) => s.financeCategories);
  const merchants = useStore((s) => s.financeMerchants);
  const batches = useStore((s) => s.financeImportBatches);
  const settlements = useStore((s) => s.financeSettlements);
  const partnerName = useStore((s) => s.partnerName);
  const fileTransaction = useStore((s) => s.fileTransaction);
  const removeFinanceTransaction = useStore((s) => s.removeFinanceTransaction);
  const [hasSaved, setHasSaved] = useState(false);

  const stored = readTransactionForm(txn);

  // A category correction teaches the merchant; `fileTransaction` is the only path that does.
  const write = (patch: Partial<FinanceTransaction>) => {
    if (Object.keys(patch).length === 0) return;
    fileTransaction(txn.id, patch);
    setHasSaved(true);
  };
  const commitText = (patch: Partial<TransactionFormValues>) =>
    write(diffTransactionPatch(txn, { ...readTransactionForm(txn), ...patch }));

  const fields = {
    title: useAutosavedText(stored.title, (title) => commitText({ title })),
    amountInput: useAutosavedText(stored.amountInput, (amountInput) => commitText({ amountInput })),
    sharePercentInput: useAutosavedText(stored.sharePercentInput, (sharePercentInput) =>
      commitText({ sharePercentInput }),
    ),
    note: useAutosavedText(stored.note, (note) => commitText({ note })),
  };

  const values: TransactionFormValues = {
    ...stored,
    title: fields.title.value,
    amountInput: fields.amountInput.value,
    sharePercentInput: fields.sharePercentInput.value,
    note: fields.note.value,
  };

  // A control that moves a text field alongside itself (Shared setting the even split) has to land
  // as one write, or the row is briefly household at the wrong share.
  const handleChange = (next: TransactionFormValues) => {
    const discretePatch = diffTransactionPatch(txn, {
      ...next,
      title: stored.title,
      amountInput: stored.amountInput,
      sharePercentInput: stored.sharePercentInput,
      note: stored.note,
    });
    if (Object.keys(discretePatch).length > 0) {
      write(diffTransactionPatch(txn, next));
      return;
    }
    for (const key of TEXT_KEYS) {
      if (next[key] !== values[key]) fields[key].setValue(next[key]);
    }
  };

  const merchant = merchants.find((row) => row.id === txn.merchantId) ?? null;
  const isSaving = TEXT_KEYS.some((key) => fields[key].isSaving);
  const isSettled = isTransactionLocked(txn, listSettledMonths(settlements));

  return (
    <FinancePageShell
      title={
        <input
          type="text"
          aria-label="Transaction title"
          maxLength={120}
          placeholder={resolveTransactionTitle(txn, merchant)}
          value={values.title}
          onChange={(event) => fields.title.setValue(event.target.value)}
          className={TITLE_CLASS}
        />
      }
      subLine={describeSaveState(isSaving, hasSaved)}
      width="regular"
      backLink={BACK_LINK}
      headerAction={
        <Button
          variant="secondary"
          onPress={() => {
            onArchive(txn);
            removeFinanceTransaction(txn.id);
          }}
        >
          <Icon name="archive" size={14} aria-hidden />
          Archive
        </Button>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <ProvenanceStrip txn={txn} batches={batches} isSettled={isSettled} />
        <TransactionFormFields
          values={values}
          errors={describeFormErrors(values)}
          categories={selectAssignableCategories(categories)}
          merchants={merchants}
          partnerName={partnerName}
          variant="edit"
          onChange={handleChange}
        />
      </div>
    </FinancePageShell>
  );
}
