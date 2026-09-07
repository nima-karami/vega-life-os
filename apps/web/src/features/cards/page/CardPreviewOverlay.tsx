import { Modal, useOverlayState } from "@heroui/react";
import { useEffect, useState } from "react";
import { draftSafeBackdrop, IconButton } from "@/core/ui";
import { TurnableCard } from "../face/TurnableCard";
import type { SampledCard } from "./card-sample";
import { fitPreviewScale, PREVIEW_CARD_H, PREVIEW_CARD_W } from "./preview-scale";

const readViewport = (): number =>
  fitPreviewScale(
    window.visualViewport?.width ?? window.innerWidth,
    window.visualViewport?.height ?? window.innerHeight,
  );

function useFittedPreviewScale(): number {
  const [scale, setScale] = useState(readViewport);

  useEffect(() => {
    const refit = () => setScale(readViewport());
    refit();
    window.addEventListener("resize", refit);
    window.addEventListener("orientationchange", refit);
    window.visualViewport?.addEventListener("resize", refit);
    return () => {
      window.removeEventListener("resize", refit);
      window.removeEventListener("orientationchange", refit);
      window.visualViewport?.removeEventListener("resize", refit);
    };
  }, []);

  return scale;
}

export function CardPreviewOverlay({
  open,
  preview,
  onClose,
}: {
  open: boolean;
  preview: SampledCard;
  onClose: () => void;
}) {
  const scale = useFittedPreviewScale();
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
        {/* Written out rather than useCompactModal: the tablet band gets the full-screen treatment too. */}
        <Modal.Container size="full" scroll="inside" placement="center">
          <Modal.Dialog
            aria-label="Card preview"
            className="relative flex h-full w-full items-center justify-center border-0 bg-transparent p-0 shadow-none"
          >
            <IconButton
              name="close"
              label="Close preview"
              size={18}
              onPress={onClose}
              className="absolute top-3 right-3 h-11 w-11"
            />
            <div
              data-testid="preview-card"
              className="relative"
              style={{ width: PREVIEW_CARD_W * scale, height: PREVIEW_CARD_H * scale }}
            >
              <TurnableCard
                card={preview.card}
                sampleSlots={preview.sampleSlots}
                scale={scale}
                faceClass="rounded-[24px] border border-border shadow-soft"
              />
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
