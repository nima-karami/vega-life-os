import { Button, ButtonGroup, Modal, useOverlayState } from "@heroui/react";
import type { FinanceTransaction } from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { DatePicker, draftSafeBackdrop, Icon, NONE, Select, useCompactModal } from "@/core/ui";
import {
  FIELD_CLASS,
  FinanceQuickAddOptions,
  MAX_SPREAD_MONTHS,
  MIN_SPREAD_MONTHS,
  type QuickAddOptionValues,
} from "./FinanceQuickAddOptions";
import { formatCents } from "./money";
import { parseAmountToCents, parseQuickAddDraft, parseSharePercentToBps } from "./quick-add-draft";

const DEFAULT_SHARE_PERCENT = "50";
const FULL_SHARE_BPS = 10000;
const PAYERS: { value: FinanceTransaction["payer"]; label: string }[] = [
  { value: "me", label: "Me" },
  { value: "partner", label: "Partner" },
];

interface QuickAddValues extends QuickAddOptionValues {
  amountInput: string;
  description: string;
  txnDate: string | null;
  categoryId: string;
  payer: FinanceTransaction["payer"];
}

function readInitialValues(query: string): QuickAddValues {
  const draft = parseQuickAddDraft(query);
  return {
    amountInput: draft.amountInput,
    description: draft.description,
    txnDate: todayISO(),
    categoryId: NONE,
    payer: "me",
    isHousehold: false,
    sharePercentInput: DEFAULT_SHARE_PERCENT,
    spreadMonths: MIN_SPREAD_MONTHS,
    note: "",
  };
}

const readAmountError = (input: string, cents: number | null) => {
  if (input.trim() === "") return null;
  if (cents === null) return "Enter an amount like 4.50";
  return cents === 0 ? "Amount must be more than zero" : null;
};

const readShareError = (isHousehold: boolean, bps: number | null) => {
  if (!isHousehold) return null;
  return bps === null || bps > FULL_SHARE_BPS ? "Enter a share between 0 and 100" : null;
};

const isSpreadValid = (months: number) =>
  Number.isInteger(months) && months >= MIN_SPREAD_MONTHS && months <= MAX_SPREAD_MONTHS;

/**
 * The in-month capture surface: the partner reports a purchase, or cash moves with no bank row
 * behind it. Writes the same shape the importer writes — `source: "manual"` and no dedupe key —
 * so a later statement can recognise the row instead of duplicating it.
 */
export function FinanceQuickAddModal({
  isOpen,
  openToken,
  query,
  onClose,
}: {
  isOpen: boolean;
  /** Bumped per open so the same ⌘K text twice still re-seeds the form. */
  openToken: number;
  query: string;
  onClose: () => void;
}) {
  const financeCategories = useStore((s) => s.financeCategories);
  const addFinanceTransaction = useStore((s) => s.addFinanceTransaction);
  const pushToast = useStore((s) => s.pushToast);

  const [values, setValues] = useState<QuickAddValues>(() => readInitialValues(query));
  const [isExpanded, setIsExpanded] = useState(false);

  const openKey = isOpen ? openToken : null;
  const prevKey = useRef<number | null>(null);
  if (prevKey.current !== openKey) {
    prevKey.current = openKey;
    if (isOpen) {
      setValues(readInitialValues(query));
      setIsExpanded(false);
    }
  }

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen) amountRef.current?.focus();
  }, [isOpen]);

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const setField = (patch: Partial<QuickAddValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  // A row she paid for is a household row by definition — the only reason it is in here at all.
  const handlePayerChange = (payer: FinanceTransaction["payer"]) => {
    if (payer === "partner") {
      setIsExpanded(true);
      setField({ payer, isHousehold: true });
      return;
    }
    setField({ payer });
  };

  const amountCents = parseAmountToCents(values.amountInput);
  const shareBps = parseSharePercentToBps(values.sharePercentInput);
  const amountError = readAmountError(values.amountInput, amountCents);
  const shareError = readShareError(values.isHousehold, shareBps);
  const canSave =
    amountCents !== null &&
    amountCents > 0 &&
    values.description.trim() !== "" &&
    values.txnDate !== null &&
    shareError === null &&
    isSpreadValid(values.spreadMonths);

  const categoryOptions = [
    { value: NONE, label: "Uncategorised" },
    ...financeCategories
      .filter((category) => category.archivedAt === null && category.kind === "spend")
      .sort((left, right) => left.order - right.order)
      .map((category) => ({ value: category.id, label: category.name })),
  ];

  const handleSave = () => {
    if (!canSave || amountCents === null || values.txnDate === null) return;
    const categoryId = values.categoryId === NONE ? null : values.categoryId;
    const description = values.description.trim();
    addFinanceTransaction({
      txnDate: values.txnDate,
      description,
      amountCents: -amountCents,
      categoryId,
      accountId: null,
      payer: values.payer,
      isHousehold: values.isHousehold,
      myShareBps: values.isHousehold ? (shareBps ?? FULL_SHARE_BPS) : FULL_SHARE_BPS,
      spreadMonths: values.spreadMonths,
      note: values.note.trim(),
      source: "manual",
      enteredBy: values.payer === "partner" ? "partner-reported" : "me",
      // `no-category` is derived from a null categoryId at read time, never stored — a
      // stored copy would need clearing on every path that later sets a category.
      reviewFlags: [],
    });
    pushToast(`Added ${description} — ${formatCents(amountCents)}`);
    onClose();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Add expense">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold text-foreground">
                Add expense
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-xs text-muted">Amount</span>
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="decimal"
                    aria-label="Amount"
                    aria-invalid={amountError !== null}
                    placeholder="0.00"
                    value={values.amountInput}
                    onChange={(event) => setField({ amountInput: event.target.value })}
                    className={`${FIELD_CLASS} tabular-nums`}
                  />
                  {amountError && (
                    <span className="block text-xs text-danger" role="alert">
                      {amountError}
                    </span>
                  )}
                </label>
                <DatePicker value={values.txnDate} onChange={(txnDate) => setField({ txnDate })} />
              </div>

              <label className="block space-y-2">
                <span className="text-xs text-muted">Description</span>
                <input
                  type="text"
                  aria-label="Description"
                  placeholder="What it was"
                  value={values.description}
                  onChange={(event) => setField({ description: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>

              <div className="space-y-2">
                <span className="block text-xs text-muted">Category</span>
                <Select
                  ariaLabel="Category"
                  value={values.categoryId}
                  onValueChange={(categoryId) => setField({ categoryId })}
                  options={categoryOptions}
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs text-muted">Paid by</span>
                <ButtonGroup fullWidth>
                  {PAYERS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      aria-pressed={values.payer === option.value}
                      variant={values.payer === option.value ? "primary" : "outline"}
                      onPress={() => handlePayerChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>

              {isExpanded ? (
                <FinanceQuickAddOptions
                  values={values}
                  onChange={setField}
                  amountCents={amountCents ?? 0}
                  shareBps={shareBps}
                  shareError={shareError}
                />
              ) : (
                <button
                  type="button"
                  aria-expanded={false}
                  onClick={() => setIsExpanded(true)}
                  className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
                >
                  Split, spread or annotate
                  <Icon name="chevD" size={14} aria-hidden />
                </button>
              )}

              {!canSave && (
                <p className="text-xs text-muted">An amount and a description are required.</p>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button size="sm" variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" isDisabled={!canSave} onPress={handleSave}>
                Add expense
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
