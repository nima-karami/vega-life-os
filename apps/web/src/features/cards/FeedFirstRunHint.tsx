import { Button } from "@heroui/react";
import { cx } from "@/core/ui";
import { BARE_CONTROL } from "./feed-chrome";

const HINT = "Tap a card to see the other side.";
const RAIL_CLEARANCE_PX = 64;

export function FeedFirstRunHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2.5" style={{ paddingRight: RAIL_CLEARANCE_PX }}>
      <span className="text-[13px] text-muted">{HINT}</span>
      <Button
        variant="ghost"
        onPress={onDismiss}
        className={cx(
          BARE_CONTROL,
          "pointer-events-auto font-medium text-[13px] text-accent focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        Got it
      </Button>
    </div>
  );
}
