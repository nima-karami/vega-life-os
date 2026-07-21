import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { useCompactModal } from "@/core/ui";

/**
 * Disconnect flow: revoke the server-side connection (the VEGA write-calendar and
 * refresh token) and drop this device's local sync cursors. The calendar and its
 * events stay in Google, and lived events stay in VEGA as a frozen snapshot.
 */
export function DisconnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const responsive = useCompactModal("sm");
  const refreshGcalStatus = useStore((s) => s.refreshGcalStatus);
  const pushToast = useStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const disconnect = async () => {
    setBusy(true);
    try {
      await getTrpcClient().calendar.disconnect.mutate();
      await refreshGcalStatus();
      pushToast("Disconnected — your VEGA calendar stays in Google");
      onClose();
    } catch {
      pushToast("Couldn’t disconnect — try again");
    } finally {
      setBusy(false);
    }
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
              <Button variant="ghost" isDisabled={busy} onPress={onClose}>
                Cancel
              </Button>
              <Button variant="danger" isDisabled={busy} onPress={() => void disconnect()}>
                Disconnect
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
