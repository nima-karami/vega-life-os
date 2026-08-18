import { Button, Modal, useOverlayState } from "@heroui/react";
import type { FinanceTransaction } from "@vega/shared";
import { useState } from "react";
import { formatShortDate, todayISO } from "@/core/lib/date";
import {
  DatePicker,
  draftSafeBackdrop,
  EditorField,
  FIELD_CLASS,
  NONE,
  Select,
  useCompactModal,
} from "@/core/ui";
import { parseAmountCents } from "./import/fields";
import { formatCents, formatCentsPlain } from "./money";
import {
  computeSettlementDirection,
  computeSettlementPayment,
  type SettlementFigures,
} from "./settlement";

export interface SettlementPayment {
  paidCents: number;
  paidAt: string;
  paymentTransactionId: string | null;
}

/**
 * Records what actually moved, not what was owed — real payments arrive short, rounded, or in two
 * instalments, and the residual is carried forward from the card rather than papered over here.
 */
export function SettlementPaymentEditor({
  figures,
  candidates,
  partnerName,
  isOpen,
  onClose,
  onSave,
}: {
  figures: SettlementFigures;
  candidates: FinanceTransaction[];
  /** Already resolved by the page — Finance holds no name of its own. */
  partnerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: SettlementPayment) => void;
}) {
  const direction = computeSettlementDirection(figures);
  // A settled month with nothing outstanding is being corrected, so offer the figure it settled at.
  const suggestedCents =
    figures.outstandingCents !== 0 ? figures.outstandingCents : figures.headlineBalanceCents;
  const [amountInput, setAmountInput] = useState(() => formatCentsPlain(Math.abs(suggestedCents)));
  const [isTouched, setIsTouched] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(todayISO());
  const [linkedId, setLinkedId] = useState(NONE);

  const magnitudeCents = parseAmountCents(amountInput);
  const isValid = magnitudeCents !== null && magnitudeCents > 0 && paidAt !== null;
  const { paidCents, residualCents } = computeSettlementPayment(figures, magnitudeCents);

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const handleSave = () => {
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
                label={
                  direction < 0 ? `Amount you paid ${partnerName}` : `Amount ${partnerName} paid`
                }
              >
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Payment amount"
                  value={amountInput}
                  onChange={(event) => {
                    setIsTouched(true);
                    setAmountInput(event.target.value);
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
              <Button variant="primary" isDisabled={!isValid} onPress={handleSave}>
                Record payment
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
