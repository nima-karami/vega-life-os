import { useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog } from "@/core/ui";
import { gcalConfigured, getCalendarToken, syncNow } from "@/features/calendar-sync";

/**
 * Q3 recovery prompt: when a background sync finds the VEGA write-calendar gone in
 * Google, the engine pauses the task lane and raises `gcalMissing`. Surface that here
 * — recreate (interactive sync re-creates the calendar + re-pushes tasks, clearing the
 * flag) or stay disconnected (turn sync off). VEGA never recreates silently.
 */
export function VegaCalendarMissingDialog() {
  const missing = useStore((s) => s.gcalMissing);
  const enabled = useStore((s) => s.gcal.enabled);
  const setMissing = useStore((s) => s.setGcalMissing);
  const setEnabled = useStore((s) => s.setGcalEnabled);
  const pushToast = useStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  if (!gcalConfigured || !enabled || !missing) return null;

  const recreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await getCalendarToken(true);
      await syncNow(true); // interactive → recreates the calendar, re-pushes tasks, clears gcalMissing
      pushToast("VEGA calendar recreated");
    } catch {
      pushToast("Couldn’t recreate the VEGA calendar");
    } finally {
      setBusy(false);
    }
  };

  const stayDisconnected = () => {
    setEnabled(false);
    setMissing(false);
    pushToast("Google Calendar disconnected");
  };

  return (
    <ConfirmDialog
      open
      title="Recreate your VEGA calendar?"
      body="Your VEGA calendar was removed in Google. Recreate it and re-push your scheduled tasks? Choosing “Stay disconnected” turns sync off — you can reconnect anytime in Settings."
      confirmLabel="Recreate"
      cancelLabel="Stay disconnected"
      onConfirm={() => void recreate()}
      onClose={stayDisconnected}
    />
  );
}
