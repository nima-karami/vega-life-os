import { Button } from "@/core/ui";
import { formatMonthLabel } from "./month-cursor";
import type { SettlementFigures } from "./settlement";

export type SettlementAction = "settle" | "resettle" | "carry" | "pay" | "reopen";

/**
 * One row of actions, gated on the month's phase: an open month settles, an amended one re-settles
 * or hands its difference on, anything still owed can be carried into the next open month, and a
 * settled month can be reopened — the lock on its rows is otherwise a dead end.
 */
export function SettlementActions({
  figures,
  nextOpenMonth,
  onAct,
}: {
  figures: SettlementFigures;
  nextOpenMonth: string;
  onAct: (action: SettlementAction) => void;
}) {
  const isOpen = figures.phase === "open";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOpen && figures.householdRowCount > 0 && (
        <Button solid icon="handshake" onPress={() => onAct("settle")}>
          Mark settled
        </Button>
      )}
      {figures.phase === "amended" && (
        <Button solid icon="refresh-cw" onPress={() => onAct("resettle")}>
          Re-settle
        </Button>
      )}
      {!isOpen && figures.outstandingCents !== 0 && (
        <Button icon="send" onPress={() => onAct("carry")}>
          Carry into {formatMonthLabel(nextOpenMonth)}
        </Button>
      )}
      {!isOpen && (
        <Button icon="banknote" onPress={() => onAct("pay")}>
          Record payment
        </Button>
      )}
      {!isOpen && (
        <Button icon="edit" onPress={() => onAct("reopen")}>
          Reopen for editing
        </Button>
      )}
    </div>
  );
}
