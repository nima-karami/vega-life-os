import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { cx } from "./cx";
import { Label } from "./primitives";

/** A centered, on-brand confirm modal on HeroUI — replaces window.confirm. */
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
      <ModalContent className="bg-[var(--color-surface)]">
        <ModalHeader className="flex flex-col gap-1">
          <Label>Confirm</Label>
          <span className="font-display text-xl font-bold leading-tight tracking-[-0.03em]">
            {title}
          </span>
        </ModalHeader>
        {body && (
          <ModalBody>
            <div className="font-sans text-[13px] leading-relaxed text-[var(--color-muted)]">
              {body}
            </div>
          </ModalBody>
        )}
        <ModalFooter>
          <Button
            variant="bordered"
            onPress={onClose}
            className="rounded-[var(--radius-sm)] border-[var(--color-line)] font-sans text-[13px] font-medium text-[var(--color-ink)] data-[hover=true]:border-[var(--color-accent)] data-[hover=true]:bg-[var(--color-canvas)]"
          >
            {cancelLabel}
          </Button>
          <Button
            autoFocus
            onPress={onConfirm}
            className={cx(
              "rounded-[var(--radius-sm)] font-sans text-[13px] font-medium",
              danger
                ? "border border-[var(--color-signal)] bg-transparent text-[var(--color-signal)] data-[hover=true]:bg-[var(--color-signal)] data-[hover=true]:text-[var(--color-accent-foreground)]"
                : "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]",
            )}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
