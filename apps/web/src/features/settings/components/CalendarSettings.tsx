import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { CalendarPicker } from "@/features/calendar/CalendarPicker";
import { SettingsCard } from "../SettingsCard";
import { DisconnectDialog } from "./DisconnectDialog";

export function CalendarSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const status = useStore((s) => s.gcalStatus);
  const refreshGcalStatus = useStore((s) => s.refreshGcalStatus);
  const on = status?.connected ?? false;
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    void refreshGcalStatus();
  }, [refreshGcalStatus]);

  const connect = async () => {
    setBusy(true);
    try {
      const { consentUrl } = await getTrpcClient().calendar.connect.query();
      window.location.assign(consentUrl);
    } catch {
      pushToast("Couldn’t start Google connection");
      setBusy(false);
    }
  };
  // Sync runs server-side; this pulls the latest server truth into the store.
  const sync = async () => {
    setBusy(true);
    try {
      await useStore.getState().refetchAll();
      await refreshGcalStatus();
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
