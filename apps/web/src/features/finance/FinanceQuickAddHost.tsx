import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useStore } from "@/core/store";

/**
 * Consumes the one-shot ⌘K quick-add draft the command stashes on the UI slice and holds it
 * for the ledger. The full capture modal (amount, date, category, payer, share) is built on
 * top of this seam.
 */
export function FinanceQuickAddHost() {
  const pendingFinanceEntry = useStore((s) => s.pendingFinanceEntry);
  const setPendingFinanceEntry = useStore((s) => s.setPendingFinanceEntry);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (pendingFinanceEntry === null) return;
    setDraft(pendingFinanceEntry);
    setPendingFinanceEntry(null);
  }, [pendingFinanceEntry, setPendingFinanceEntry]);

  if (draft === null) return null;

  return (
    <div
      role="status"
      className="safe-inset-x fixed inset-x-0 bottom-6 z-40 mx-auto flex w-full max-w-md items-center gap-3 rounded-[16px] border border-border bg-surface px-4 py-3 shadow-md"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        Quick-add draft: {draft || "an expense"}
      </span>
      <Button variant="secondary" onPress={() => setDraft(null)}>
        Dismiss
      </Button>
    </div>
  );
}
