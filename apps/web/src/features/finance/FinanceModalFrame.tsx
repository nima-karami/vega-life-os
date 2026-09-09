import { Modal, useOverlayState } from "@heroui/react";
import type { ReactNode } from "react";
import { draftSafeBackdrop, useCompactModal } from "@/core/ui";

/** The centered shell every finance flow renders into — draft-safe backdrop, sheet on a phone. */
export function FinanceModalFrame({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const responsive = useCompactModal("sm");
  const state = useOverlayState({
    isOpen: true,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label={title}>
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold text-foreground">
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">{children}</Modal.Body>
            <Modal.Footer className="justify-end gap-2">{footer}</Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
