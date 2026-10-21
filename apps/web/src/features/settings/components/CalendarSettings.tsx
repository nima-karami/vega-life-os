import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { CalendarPicker } from "@/features/calendar/CalendarPicker";
import { WriteCalendarMissingBanner } from "@/features/calendar/WriteCalendarMissingBanner";
import { describeSyncFailure } from "@/features/calendar-sync/sync-feedback";
import { shouldUpdateTimeZone } from "@/features/calendar-sync/timezone";
import { SettingsCard } from "../SettingsCard";
import { DisconnectDialog } from "./DisconnectDialog";

export function CalendarSettings() {
  const authUid = useStore((s) => s.authUid);
  const pushToast = useStore((s) => s.pushToast);
  const status = useStore((s) => s.gcalStatus);
  const refreshGcalStatus = useStore((s) => s.refreshGcalStatus);
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    void refreshGcalStatus();
  }, [refreshGcalStatus]);

  useEffect(() => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!status?.connected || !shouldUpdateTimeZone(status.timeZone, browserZone)) return;
    void getTrpcClient()
      .calendar.setTimeZone.mutate({ timeZone: browserZone })
      .then(() => refreshGcalStatus())
      .catch(() => {});
  }, [status?.connected, status?.timeZone, refreshGcalStatus]);

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

  const sync = async () => {
    setBusy(true);
    try {
      const result = await getTrpcClient().calendar.syncNow.mutate();
      await useStore.getState().refetchAll();
      await refreshGcalStatus();
      pushToast(
        result.synced
          ? "Calendar synced"
          : describeSyncFailure("reason" in result ? result.reason : undefined),
      );
    } catch {
      pushToast("Sync failed. Reconnect?");
    } finally {
      setBusy(false);
    }
  };

  if (authUid == null) return null;

  return (
    <SettingsCard
      title="Google Calendar"
      description="Two-way sync for scheduled tasks. Blocks you schedule in VEGA appear in Google Calendar (with reminders); moving or deleting a VEGA event in Google flows back here on the next sync."
    >
      <div className="flex flex-col gap-4">
        {status?.needsReauth ? (
          <>
            <p className="flex items-start gap-1.5 text-sm text-warning">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
              <span>Google access expired. Reconnect to resume syncing.</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" isDisabled={busy} onPress={() => void connect()}>
                <Icon name="refresh-cw" size={15} />
                Reconnect
              </Button>
            </div>
          </>
        ) : status?.connected ? (
          <>
            <CalendarPicker />
            {status.writeCalendarMissing && <WriteCalendarMissingBanner />}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" isDisabled={busy} onPress={() => void sync()}>
                <Icon name="refresh-cw" size={15} />
                Sync now
              </Button>
              <Button variant="danger-soft" onPress={() => setDisconnecting(true)}>
                <Icon name="close" size={15} />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" isDisabled={busy} onPress={() => void connect()}>
              <Icon name="calendar" size={15} />
              Connect Google Calendar
            </Button>
          </div>
        )}
      </div>
      <DisconnectDialog open={disconnecting} onClose={() => setDisconnecting(false)} />
    </SettingsCard>
  );
}
