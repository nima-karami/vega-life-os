import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { pluralize } from "@/core/lib/plural";
import { FIELD_CLASS, useCompactModal } from "@/core/ui";

export const canConfirmDelete = (typed: string): boolean => typed.trim().toLowerCase() === "delete";

export const describeDeletePrompt = (count: number): string =>
  `Delete ${pluralize(count, "card")}?`;

/** Irreversible and plural, so it keeps the typed guard *and* still offers the undo bar after. */
export function DeleteSelectionDialog({
  count,
  isOpen,
  onConfirm,
  onClose,
}: {
  count: number;
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const responsive = useCompactModal("sm");
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) {
        setTyped("");
        onClose();
      }
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="font-semibold text-lg tracking-tight">
                {describeDeletePrompt(count)}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted text-sm leading-relaxed">
                This removes every selected card, including any the current filter hides. Type{" "}
                <span className="font-medium text-foreground">delete</span> to confirm.
              </p>
              <input
                type="text"
                value={typed}
                aria-label="Type delete to confirm"
                placeholder="delete"
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
                className={`${FIELD_CLASS} mt-3`}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isDisabled={!canConfirmDelete(typed)}
                onPress={() => {
                  setTyped("");
                  onConfirm();
                }}
              >
                Delete
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
