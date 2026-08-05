import { Button } from "@/core/ui";
import { FinanceNotice } from "./FinanceNotice";
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
        <FinanceNotice
          tone="warning"
          title="You're offline."
          body="These are the figures last loaded, and an edit made now is lost on reload."
        />
      )}
      {hasLoadFailed && (
        <FinanceNotice
          tone="danger"
          title="Finance data didn't load, so this month may be missing rows."
          actions={
            <Button icon="refresh-cw" onPress={onRetry}>
              Retry
            </Button>
          }
        />
      )}
    </>
  );
}
