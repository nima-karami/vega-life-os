import { Button } from "@heroui/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useStore } from "@/core/store";
import { FinancePageShell } from "./FinancePageShell";
import { formatCents } from "./money";
import { TransactionFormFields } from "./TransactionFormFields";
import {
  buildNewTransactionPatch,
  canCommitTransactionForm,
  createTransactionForm,
  describeFormErrors,
  selectAssignableCategories,
} from "./transaction-form";

const BACK_LINK = { to: "/finance/transactions", label: "Transactions" } as const;

// The editing affordance on a fresh page: the rule says this line is the field, not a heading.
const TITLE_CLASS =
  "w-full border-black/12 border-b-[1.5px] bg-transparent pb-1.5 font-semibold text-3xl text-foreground tracking-[-0.025em] leading-[1.15] outline-none placeholder:text-muted focus:border-accent";

/** Manual entry is a routed page, not a modal — and nothing is written until the one button. */
export function FinanceNewTransactionPage() {
  const navigate = useNavigate();
  const categories = useStore((s) => s.financeCategories);
  const merchants = useStore((s) => s.financeMerchants);
  const partnerName = useStore((s) => s.partnerName);
  const addFinanceTransaction = useStore((s) => s.addFinanceTransaction);
  const fileTransaction = useStore((s) => s.fileTransaction);
  const pushToast = useStore((s) => s.pushToast);

  const [values, setValues] = useState(createTransactionForm);

  const handleSave = () => {
    const patch = buildNewTransactionPatch(values);
    if (patch === null) return;
    const added = addFinanceTransaction(patch);
    // Filing it here is what teaches the merchant, so the next row like it files itself.
    if (patch.categoryId != null) fileTransaction(added.id, { categoryId: patch.categoryId });
    pushToast(`Added ${added.title} — ${formatCents(Math.abs(added.amountCents))}`);
    navigate("/finance/transactions");
  };

  return (
    <FinancePageShell
      title={
        <input
          type="text"
          aria-label="Transaction title"
          maxLength={120}
          placeholder="What it was"
          value={values.title}
          onChange={(event) => setValues({ ...values, title: event.target.value })}
          className={TITLE_CLASS}
        />
      }
      subLine="The title is the handle — the ledger, the omni field and search all use it."
      width="regular"
      backLink={BACK_LINK}
      headerAction={
        <>
          <Button variant="ghost" onPress={() => navigate("/finance/transactions")}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!canCommitTransactionForm(values)}
            onPress={handleSave}
          >
            Add transaction
          </Button>
        </>
      }
    >
      <div className="mt-4">
        <TransactionFormFields
          values={values}
          errors={describeFormErrors(values)}
          categories={selectAssignableCategories(categories)}
          merchants={merchants}
          partnerName={partnerName}
          variant="new"
          onChange={setValues}
        />
      </div>
    </FinancePageShell>
  );
}
