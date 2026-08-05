import { Button, Modal, useOverlayState } from "@heroui/react";
import type { FinanceTransaction } from "@vega/shared";
import { useState } from "react";
import { formatShortDate, todayISO } from "@/core/lib/date";
import { DatePicker, draftSafeBackdrop, NONE, Select, useCompactModal } from "@/core/ui";
import { FIELD_CLASS } from "@/features/goals/components/field-styles";
import { EditorField } from "@/features/values/components/editor-bits";
import { parseAmountCents } from "./import";
import { formatCents } from "./money";
import type { SettlementFigures } from "./settlement";

export interface SettlementPayment {
  paidCents: number;
  paidAt: string;
  paymentTransactionId: string | null;
}

/** Signed toward the balance, so discharging a debt the owner owes records a negative payment. */
const directionOf = (figures: SettlementFigures) => (figures.headlineBalanceCents < 0 ? -1 : 1);

const dollarsOf = (cents: number) => (Math.abs(cents) / 100).toFixed(2);

/**
 * Records what actually moved, not what was owed — real payments arrive short, rounded, or in two
 * instalments, and the residual is carried forward from the card rather than papered over here.
 */
export function SettlementPaymentEditor({
  figures,
  candidates,
  isOpen,
  onClose,
  onSave,
}: {
  figures: SettlementFigures;
  candidates: FinanceTransaction[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: SettlementPayment) => void;
}) {
  const direction = directionOf(figures);
  // A settled month with nothing outstanding is being corrected, so offer the figure it settled at.
  const suggestedCents =
    figures.outstandingCents !== 0 ? figures.outstandingCents : figures.headlineBalanceCents;
  const [amount, setAmount] = useState(() => dollarsOf(suggestedCents));
  const [isTouched, setIsTouched] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(todayISO());
  const [linkedId, setLinkedId] = useState(NONE);

  const magnitudeCents = parseAmountCents(amount);
  const isValid = magnitudeCents !== null && magnitudeCents > 0 && paidAt !== null;
  const paidCents = magnitudeCents === null ? 0 : direction * Math.abs(magnitudeCents);
  const residualCents = figures.headlineBalanceCents - paidCents;

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const submit = () => {
    if (!isValid || paidAt === null) return;
    onSave({ paidCents, paidAt, paymentTransactionId: linkedId === NONE ? null : linkedId });
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Record a settlement payment">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold text-foreground">
                Record payment
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-5">
              <EditorField
                label={direction < 0 ? "Amount you paid your partner" : "Amount your partner paid"}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Payment amount"
                  value={amount}
                  onChange={(event) => {
                    setIsTouched(true);
                    setAmount(event.target.value);
                  }}
                  className={`${FIELD_CLASS} tabular-nums`}
                />
                {isTouched && !isValid && (
                  <p className="text-xs text-danger">Enter an amount above zero.</p>
                )}
              </EditorField>

              <DatePicker label="Paid on" value={paidAt} onChange={setPaidAt} />

              <EditorField label="Matching transaction">
                <Select
                  ariaLabel="Matching transaction"
                  value={linkedId}
                  onValueChange={setLinkedId}
                  placeholder="Not linked"
                  options={[
                    { value: NONE, label: "Not linked" },
                    ...candidates.map((txn) => ({
                      value: txn.id,
                      label: `${formatShortDate(txn.txnDate)} · ${txn.description} · ${formatCents(txn.amountCents)}`,
                    })),
                  ]}
                />
              </EditorField>

              {isValid && residualCents !== 0 && (
                <p className="text-xs text-muted tabular-nums">
                  {formatCents(Math.abs(residualCents))} of{" "}
                  {formatCents(Math.abs(figures.headlineBalanceCents))} would still be outstanding —
                  carry it forward from the month card.
                </p>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button variant="primary" isDisabled={!isValid} onPress={submit}>
                Record payment
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
