import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { useCompactModal } from "@/core/ui";
import {
  clearAllSyncTokens,
  clearCalendarToken,
  deleteVegaCalendar,
} from "@/features/calendar-sync";

type Phase = "choose" | "confirm-remove";

/**
 * Disconnect flow (Q1): always ask, defaulting to KEEP. Removing the VEGA calendar
 * from Google is gated behind a typed "delete" confirmation. Lived events stay in
 * VEGA as a frozen snapshot either way (Q2) — neither path touches calendarEvents.
 */
export function DisconnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const responsive = useCompactModal("sm");
  const setGcalEnabled = useStore((s) => s.setGcalEnabled);
  const pushToast = useStore((s) => s.pushToast);
  const [phase, setPhase] = useState<Phase>("choose");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPhase("choose");
    setInput("");
    onClose();
  };

  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next) close();
    },
  });

  const disconnectLocally = () => {
    clearCalendarToken();
    clearAllSyncTokens();
    setGcalEnabled(false);
  };

  const keep = () => {
    disconnectLocally();
    pushToast("Disconnected — your VEGA calendar stays in Google");
    close();
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteVegaCalendar(true);
      disconnectLocally();
      pushToast("VEGA calendar removed from Google");
    } catch {
      pushToast("Couldn’t remove the calendar — try again");
    } finally {
      setBusy(false);
      close();
    }
  };

  const canRemove = input.trim().toLowerCase() === "delete";

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Disconnect Google Calendar">
            {phase === "choose" ? (
              <>
                <Modal.Header>
                  <Modal.Heading className="text-lg font-semibold tracking-tight">
                    Disconnect Google Calendar?
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <div className="text-sm leading-relaxed text-muted">
                    Your Google events already in VEGA will stay as a snapshot. Choose what happens
                    to the <strong className="text-foreground">VEGA</strong> calendar in Google:
                    keep it (and the time-blocks VEGA pushed there), or remove it entirely.
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={close}>
                    Cancel
                  </Button>
                  <Button variant="danger-soft" onPress={() => setPhase("confirm-remove")}>
                    Remove the VEGA calendar
                  </Button>
                  <Button autoFocus variant="primary" onPress={keep}>
                    Keep events in Google
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <>
                <Modal.Header>
                  <Modal.Heading className="text-lg font-semibold tracking-tight">
                    Remove the VEGA calendar?
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <div className="text-sm leading-relaxed text-muted">
                    This permanently deletes the VEGA calendar and all of its events from Google.
                    This can’t be undone. Type <strong className="text-foreground">delete</strong>{" "}
                    to confirm.
                  </div>
                  <input
                    type="text"
                    value={input}
                    autoFocus
                    onChange={(e) => setInput(e.target.value)}
                    aria-label="Type delete to confirm"
                    placeholder="delete"
                    className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" isDisabled={busy} onPress={() => setPhase("choose")}>
                    Back
                  </Button>
                  <Button
                    variant="danger"
                    isDisabled={!canRemove || busy}
                    onPress={() => void remove()}
                  >
                    Remove calendar
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
