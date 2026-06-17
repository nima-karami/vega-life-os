import { useState } from "react";
import { useStore } from "@/core/store";
import { Button, Panel, SectionHead } from "@/core/ui";
import {
  clearCalendarToken,
  gcalConfigured,
  getCalendarToken,
  isEnabled,
  setEnabled,
  syncNow,
} from "@/features/calendar-sync";

export function CalendarSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [on, setOn] = useState(isEnabled());
  const [busy, setBusy] = useState(false);

  if (!gcalConfigured) {
    return (
      <Panel className="mb-4 p-5">
        <SectionHead title="google calendar" />
        <p className="mono mt-3 text-[11px] leading-relaxed text-stone">
          Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code> to enable two-way
          calendar sync. Your VEGA time-blocks then appear in Google Calendar, and the Calendar app
          on your phone handles the reminders.
        </p>
      </Panel>
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
    <Panel className="mb-4 p-5">
      <SectionHead title="google calendar" />
      <p className="mono mt-3 text-[11px] leading-relaxed text-stone">
        Two-way sync for scheduled tasks. Blocks you schedule in VEGA appear in Google Calendar
        (with reminders); moving or deleting a VEGA event in Google flows back here on the next
        sync.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {on ? (
          <>
            <Button solid icon="repeat" disabled={busy} onClick={() => void sync()}>
              Sync now
            </Button>
            <Button icon="close" onClick={disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button solid icon="calendar" disabled={busy} onClick={() => void connect()}>
            Connect Google Calendar
          </Button>
        )}
      </div>
    </Panel>
  );
}
