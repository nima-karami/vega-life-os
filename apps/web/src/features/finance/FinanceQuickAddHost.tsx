import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { FinanceQuickAddModal } from "./FinanceQuickAddModal";

interface QuickAddEntry {
  query: string;
  token: number;
}

/**
 * Consumes the one-shot ⌘K quick-add draft the command stashes on the UI slice and opens the
 * capture modal on it. The token distinguishes two opens carrying the same text.
 */
export function FinanceQuickAddHost() {
  const pendingFinanceEntry = useStore((s) => s.pendingFinanceEntry);
  const setPendingFinanceEntry = useStore((s) => s.setPendingFinanceEntry);
  const [entry, setEntry] = useState<QuickAddEntry | null>(null);
  const nextToken = useRef(0);

  useEffect(() => {
    if (pendingFinanceEntry === null) return;
    nextToken.current += 1;
    setEntry({ query: pendingFinanceEntry, token: nextToken.current });
    setPendingFinanceEntry(null);
  }, [pendingFinanceEntry, setPendingFinanceEntry]);

  return (
    <FinanceQuickAddModal
      isOpen={entry !== null}
      openToken={entry?.token ?? 0}
      query={entry?.query ?? ""}
      onClose={() => setEntry(null)}
    />
  );
}
