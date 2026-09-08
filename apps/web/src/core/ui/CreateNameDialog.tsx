import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useState } from "react";
import { FIELD_CLASS } from "./field-styles";
import { smallCenteredDialogContainer } from "./modal";

/**
 * Naming the thing *is* the save. Creating an empty row and dropping the user on its page
 * meant a mis-tapped button left real, nameless clutter behind that they had to go delete.
 */
export function CreateNameDialog({
  open,
  title,
  label,
  placeholder,
  confirmLabel,
  onCreate,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const canCreate = name.trim() !== "";
  const submit = () => {
    if (!canCreate) return;
    onCreate(name.trim());
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...smallCenteredDialogContainer}>
          <Modal.Dialog aria-label={title}>
            <Modal.Header>
              <Modal.Heading className="font-semibold text-lg tracking-tight">
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <input
                type="text"
                autoFocus
                value={name}
                aria-label={label}
                placeholder={placeholder}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
                className={FIELD_CLASS}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button variant="primary" isDisabled={!canCreate} onPress={submit}>
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
