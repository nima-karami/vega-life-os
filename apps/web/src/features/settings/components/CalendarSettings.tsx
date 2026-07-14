import { Button, Code } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { CalendarPicker } from "@/features/calendar/CalendarPicker";
import { gcalConfigured, getCalendarToken } from "@/features/calendar-sync";
import { SettingsCard } from "../SettingsCard";
import { DisconnectDialog } from "./DisconnectDialog";

export function CalendarSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const on = useStore((s) => s.gcal.enabled);
  const setEnabled = useStore((s) => s.setGcalEnabled);
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!gcalConfigured) {
    return (
      <SettingsCard title="Google Calendar">
        <p className="text-sm leading-relaxed text-muted">
          Set <Code>VITE_GOOGLE_CLIENT_ID</Code> in <Code>.env.local</Code> to enable two-way
          calendar sync. Your VEGA time-blocks then appear in Google Calendar, and the Calendar app
          on your phone handles the reminders.
        </p>
      </SettingsCard>
    );
  }

  const connect = async () => {
    setBusy(true);
    try {
      await getCalendarToken(true); // consent prompt
      setEnabled(true);
      pushToast("Calendar connected");
    } catch {
      pushToast("Calendar connection failed");
    } finally {
      setBusy(false);
    }
  };
  // Sync runs server-side; this pulls the latest server truth into the store.
  const sync = async () => {
    setBusy(true);
    try {
      await useStore.getState().refetchAll();
      pushToast("Calendar refreshed");
    } catch {
      pushToast("Refresh failed — reconnect?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Google Calendar"
      description="Two-way sync for scheduled tasks. Blocks you schedule in VEGA appear in Google Calendar (with reminders); moving or deleting a VEGA event in Google flows back here on the next sync."
    >
      <div className="flex flex-col gap-4">
        {on && <CalendarPicker />}
        <div className="flex flex-wrap gap-2">
          {on ? (
            <>
              <Button variant="primary" isDisabled={busy} onPress={() => void sync()}>
                <Icon name="refresh-cw" size={15} />
                Sync now
              </Button>
              <Button variant="danger-soft" onPress={() => setDisconnecting(true)}>
                <Icon name="close" size={15} />
                Disconnect
              </Button>
            </>
          ) : (
            <Button variant="primary" isDisabled={busy} onPress={() => void connect()}>
              <Icon name="calendar" size={15} />
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>
      <DisconnectDialog open={disconnecting} onClose={() => setDisconnecting(false)} />
    </SettingsCard>
  );
}
