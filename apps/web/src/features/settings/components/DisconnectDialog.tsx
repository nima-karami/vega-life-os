import { Button, Modal, useOverlayState } from "@heroui/react";
import { useStore } from "@/core/store";
import { useCompactModal } from "@/core/ui";
import { clearAllSyncTokens, clearCalendarToken } from "@/features/calendar-sync";

/**
 * Disconnect flow: stop syncing on this device. Sync and the VEGA write-calendar
 * are server-owned now, so the client only drops its local Google token — the
 * calendar and its events stay in Google, and lived events stay in VEGA as a
 * frozen snapshot.
 */
export function DisconnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const responsive = useCompactModal("sm");
  const setGcalEnabled = useStore((s) => s.setGcalEnabled);
  const pushToast = useStore((s) => s.pushToast);

  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const disconnect = () => {
    clearCalendarToken();
    clearAllSyncTokens();
    setGcalEnabled(false);
    pushToast("Disconnected — your VEGA calendar stays in Google");
    onClose();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Disconnect Google Calendar">
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold tracking-tight">
                Disconnect Google Calendar?
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <p className="text-sm leading-relaxed text-muted">
                This stops syncing on this device. Your{" "}
                <strong className="text-foreground">VEGA</strong> calendar and its events stay in
                Google, and Google events already in VEGA stay as a snapshot. You can reconnect
                anytime.
              </p>
            </Modal.Body>
            <Modal.Footer className="justify-between" render={(props) => <footer {...props} />}>
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button variant="danger" onPress={disconnect}>
                Disconnect
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
