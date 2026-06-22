import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

/** A centered, calm confirm modal on HeroUI — replaces window.confirm. API unchanged. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} placement="center" backdrop="blur" size="sm">
      <ModalContent>
        <ModalHeader className="text-large font-semibold tracking-tight">{title}</ModalHeader>
        {body && (
          <ModalBody>
            <div className="text-small leading-relaxed text-default-500">{body}</div>
          </ModalBody>
        )}
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {cancelLabel}
          </Button>
          <Button autoFocus color={danger ? "danger" : "primary"} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
