import { Button } from "@/core/ui";
import { useOnlineStatus } from "./useOnlineStatus";

/** Offline and load-failure both mean the figures on screen may not be the whole month — say which. */
export function SettlementNotices({
  hasLoadFailed,
  onRetry,
}: {
  hasLoadFailed: boolean;
  onRetry: () => void;
}) {
  const isOnline = useOnlineStatus();
  return (
    <>
      {!isOnline && (
        <p className="mt-4 rounded-[12px] border border-border px-3 py-2 text-sm text-muted">
          You're offline. These are the figures last loaded, and an edit made now is lost on reload.
        </p>
      )}
      {hasLoadFailed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-danger px-3 py-2">
          <p className="text-sm text-danger">
            Finance data didn't load, so this month may be missing rows.
          </p>
          <Button icon="refresh-cw" onPress={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </>
  );
}
