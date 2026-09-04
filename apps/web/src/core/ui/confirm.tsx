import { Button, Modal, useOverlayState } from "@heroui/react";

/** A centered, calm confirm modal on HeroUI v3 — replaces window.confirm. API unchanged. */
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
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <Modal state={state}>
      {/* react-aria pins an open popover at z-index 100000, so a confirm raised from inside
          one has to outrank it or it renders underneath. */}
      <Modal.Backdrop variant="blur" className="z-[100001]">
        {/* A two-line confirm stays a small centered dialog on every viewport — the
            phone sheet the other modals use swallowed the whole screen for it. */}
        <Modal.Container size="sm" placement="center" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold tracking-tight">
                {title}
              </Modal.Heading>
            </Modal.Header>
            {body && (
              <Modal.Body>
                <div className="text-sm leading-relaxed text-muted">{body}</div>
              </Modal.Body>
            )}
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                {cancelLabel}
              </Button>
              <Button autoFocus variant={danger ? "danger" : "primary"} onPress={onConfirm}>
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
