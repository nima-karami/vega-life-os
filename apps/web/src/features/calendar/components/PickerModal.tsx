import { Modal, useOverlayState } from "@heroui/react";
import type { ReactNode } from "react";
import { useCompactModal } from "@/core/ui";

/** The centered pick-one dialog behind the calendar's keyboard and menu pathways. */
export function PickerModal({
  isOpen,
  label,
  title,
  subtitle,
  onClose,
  children,
}: {
  isOpen: boolean;
  label: string;
  title: string;
  subtitle: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const modalResponsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });
  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...modalResponsive}>
          <Modal.Dialog aria-label={label}>
            <Modal.Header className="flex-col items-start gap-0.5">
              <Modal.Heading className="text-base font-semibold text-foreground">
                {title}
              </Modal.Heading>
              {subtitle && <span className="text-sm font-normal text-muted">{subtitle}</span>}
            </Modal.Header>
            <Modal.Body className="pb-6">{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
