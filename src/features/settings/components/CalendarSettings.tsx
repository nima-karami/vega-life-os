import { Button, Code } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import {
  clearCalendarToken,
  gcalConfigured,
  getCalendarToken,
  isEnabled,
  setEnabled,
  syncNow,
} from "@/features/calendar-sync";
import { SettingsCard } from "../SettingsCard";

export function CalendarSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [on, setOn] = useState(isEnabled());
  const [busy, setBusy] = useState(false);

  if (!gcalConfigured) {
    return (
      <SettingsCard title="Google Calendar">
        <p className="text-small leading-relaxed text-default-500">
          Set <Code size="sm">VITE_GOOGLE_CLIENT_ID</Code> in <Code size="sm">.env.local</Code> to
          enable two-way calendar sync. Your VEGA time-blocks then appear in Google Calendar, and
          the Calendar app on your phone handles the reminders.
        </p>
      </SettingsCard>
    );
  }

  const connect = async () => {
    setBusy(true);
    try {
      await getCalendarToken(true); // consent prompt
      setEnabled(true);
      setOn(true);
      const r = await syncNow(true);
      pushToast(`Calendar connected — ${r.pushed} blocks synced`);
    } catch {
      pushToast("Calendar connection failed");
    } finally {
      setBusy(false);
    }
  };
  const disconnect = () => {
    clearCalendarToken();
    setEnabled(false);
    setOn(false);
    pushToast("Calendar disconnected");
  };
  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncNow(true);
      pushToast(`Synced · ${r.pushed} up, ${r.pulled} down`);
    } catch {
      pushToast("Sync failed — reconnect?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Google Calendar"
      description="Two-way sync for scheduled tasks. Blocks you schedule in VEGA appear in Google Calendar (with reminders); moving or deleting a VEGA event in Google flows back here on the next sync."
    >
      <div className="flex flex-wrap gap-2">
        {on ? (
          <>
            <Button
              color="primary"
              startContent={<Icon name="repeat" size={15} />}
              isDisabled={busy}
              onPress={() => void sync()}
            >
              Sync now
            </Button>
            <Button
              variant="flat"
              color="danger"
              startContent={<Icon name="close" size={15} />}
              onPress={disconnect}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            color="primary"
            startContent={<Icon name="calendar" size={15} />}
            isDisabled={busy}
            onPress={() => void connect()}
          >
            Connect Google Calendar
          </Button>
        )}
      </div>
    </SettingsCard>
  );
}
