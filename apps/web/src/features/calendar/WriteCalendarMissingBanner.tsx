import { Button } from "@heroui/react";
import { useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { DisconnectDialog } from "@/features/settings/components/DisconnectDialog";

/** Pause-and-ask surface for a VEGA calendar deleted on Google — never auto-recreates (user decision). */
export function WriteCalendarMissingBanner() {
  const pushToast = useStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const recreate = async () => {
    setBusy(true);
    try {
      await getTrpcClient().calendar.recreateWriteCalendar.mutate();
      await useStore.getState().refreshGcalStatus();
      await useStore.getState().refetchAll();
      pushToast("VEGA calendar recreated, tasks re-synced");
    } catch {
      pushToast("Couldn’t recreate the calendar. Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] border border-warning/30 bg-warning/10 px-4 py-3"
    >
      <Icon name="alert" size={16} className="shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-sm text-foreground">
        Your <span className="font-medium">VEGA</span> calendar was removed from Google. Sync is
        paused until you choose what to do.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" isDisabled={busy} onPress={() => void recreate()}>
          Recreate calendar
        </Button>
        <Button size="sm" variant="danger-soft" onPress={() => setDisconnecting(true)}>
          Disconnect
        </Button>
      </div>
      <DisconnectDialog open={disconnecting} onClose={() => setDisconnecting(false)} />
    </div>
  );
}
