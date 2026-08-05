import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selectIdRange } from "./transactions-query";

export interface TransactionSelection {
  selectedIds: Set<string>;
  isAllSelected: boolean;
  toggleOne: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("input, textarea, [role='dialog']") !== null;

/**
 * Multi-select over the rows currently on screen. Selection is intersected with the visible ids
 * rather than pruned in an effect, so narrowing a filter can never leave a bulk action pointed at
 * a row the owner can no longer see. Shift is read in the capture phase because the checkbox's
 * own change event carries no modifier state.
 */
export function useTransactionSelection(orderedIds: string[]): TransactionSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);
  const rangeRef = useRef(false);
  // The window listeners read the ids through this, so a filter change doesn't re-register them —
  // and the live closure holds a ref rather than a whole ledger's worth of ids.
  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;

  const orderedIdSet = useMemo(() => new Set(orderedIds), [orderedIds]);
  const activeIds = useMemo(
    () => new Set([...selectedIds].filter((id) => orderedIdSet.has(id))),
    [selectedIds, orderedIdSet],
  );

  const toggleOne = useCallback(
    (id: string) => {
      const isRange = rangeRef.current;
      const anchorId = anchorRef.current;
      anchorRef.current = id;
      setSelectedIds((current) => {
        const next = new Set([...current].filter((selected) => orderedIdSet.has(selected)));
        if (isRange && anchorId !== null) {
          for (const rangeId of selectIdRange(orderedIds, anchorId, id)) next.add(rangeId);
          return next;
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [orderedIds, orderedIdSet],
  );

  const toggleAll = useCallback(() => {
    anchorRef.current = null;
    setSelectedIds((current) => {
      const isEverythingSelected =
        orderedIds.length > 0 && orderedIds.every((id) => current.has(id));
      return isEverythingSelected ? new Set() : new Set(orderedIds);
    });
  }, [orderedIds]);

  const clear = useCallback(() => {
    anchorRef.current = null;
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    anchorRef.current = null;
    setSelectedIds(new Set(orderedIdsRef.current));
  }, []);

  useEffect(() => {
    const noteRangeIntent = (event: PointerEvent | KeyboardEvent) => {
      rangeRef.current = event.shiftKey;
    };
    const handleShortcut = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") clear();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("pointerdown", noteRangeIntent, true);
    window.addEventListener("keydown", noteRangeIntent, true);
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("pointerdown", noteRangeIntent, true);
      window.removeEventListener("keydown", noteRangeIntent, true);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [clear, selectAll]);

  const isAllSelected = orderedIds.length > 0 && activeIds.size === orderedIds.length;

  return { selectedIds: activeIds, isAllSelected, toggleOne, toggleAll, clear };
}
